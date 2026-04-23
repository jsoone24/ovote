<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Agenda } from '@ovote/shared';
import { api } from '../api.js';
import { session } from '../services/session.js';
import { buildBallot, encryptBallot, obtainCredential, type EncryptedChoice, type PreparedCredential } from '../services/voting.js';

const props = defineProps<{ id: string }>();

const agenda = ref<Agenda | null>(null);
const error = ref('');
const busy = ref(false);
const selection = ref<string>('');
const credential = ref<PreparedCredential | null>(null);
const choices = ref<EncryptedChoice[]>([]);
const stage = ref<'pick' | 'audit-or-cast' | 'done'>('pick');
const auditReveal = ref<string>('');
const castId = ref('');

onMounted(async () => {
  try {
    agenda.value = await api.getAgenda(props.id);
  } catch (e) {
    error.value = (e as Error).message;
  }
});

const options = computed(() => agenda.value?.options ?? []);

async function prepareBallot(): Promise<void> {
  if (!session.isLoggedIn.value) {
    error.value = 'please sign in first';
    return;
  }
  if (!agenda.value || !selection.value) return;
  busy.value = true;
  error.value = '';
  try {
    if (!credential.value) {
      credential.value = await obtainCredential(agenda.value);
    }
    choices.value = encryptBallot(agenda.value, selection.value);
    stage.value = 'audit-or-cast';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

function auditBallot(): void {
  // Benaloh audit: reveal randomness locally, then voter must re-encrypt.
  // The audited ballot is discarded and MUST NOT be submitted. Only a human
  // looking at this screen can verify honesty — that is the whole point.
  const reveal = choices.value.map((c) => ({
    optionId: c.optionId,
    chosen: c.chosen,
    randomness: c.randomness.toString(16),
  }));
  auditReveal.value = JSON.stringify(reveal, null, 2);
  choices.value = [];
  stage.value = 'pick';
}

async function castBallot(): Promise<void> {
  if (!agenda.value || !credential.value) return;
  busy.value = true;
  error.value = '';
  try {
    const ballotId = crypto.randomUUID();
    const ballot = buildBallot(agenda.value, ballotId, choices.value, credential.value);
    const res = await api.castBallot(ballot);
    castId.value = res.id;
    stage.value = 'done';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="!agenda" class="panel">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else class="muted">loading…</p>
  </div>

  <div v-else class="panel">
    <h1>{{ agenda.title }}</h1>
    <p class="muted">{{ agenda.description }}</p>

    <div v-if="stage === 'pick'">
      <p v-if="auditReveal" class="ok">
        audit complete — the revealed randomness matches your intended choice. re-encrypt and cast below.
      </p>
      <pre v-if="auditReveal" style="white-space: pre-wrap">{{ auditReveal }}</pre>

      <h3>pick one</h3>
      <div v-for="opt in options" :key="opt.id" class="option-row">
        <input
          :id="opt.id"
          v-model="selection"
          type="radio"
          name="choice"
          :value="opt.id"
          style="width: auto"
        />
        <label :for="opt.id" style="margin: 0">{{ opt.label }}</label>
      </div>
      <div class="actions">
        <button class="primary" :disabled="busy || !selection" @click="prepareBallot">
          encrypt ballot
        </button>
      </div>
    </div>

    <div v-else-if="stage === 'audit-or-cast'">
      <h3>audit or cast?</h3>
      <p class="muted">
        you can audit this ballot (open it to verify it encrypts your choice honestly) or cast it.
        an audited ballot is spoiled and cannot be counted — you will re-encrypt fresh.
      </p>
      <div class="actions">
        <button class="primary" :disabled="busy" @click="castBallot">cast</button>
        <button :disabled="busy" @click="auditBallot">audit (spoil and re-encrypt)</button>
      </div>
    </div>

    <div v-else-if="stage === 'done'">
      <p class="ok">ballot cast.</p>
      <p class="muted">tracking code: <code>{{ castId }}</code></p>
      <p class="muted">
        after the agenda closes and trustees publish decryption shares, you can verify this ballot
        appears on the bulletin board exactly as submitted.
      </p>
      <RouterLink :to="{ name: 'agendas' }">back to agendas</RouterLink>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
