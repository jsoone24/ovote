<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Agenda, TrusteeDecryptionShare } from '@ovote/shared';
import { api } from '../api.js';
import { session } from '../services/session.js';
import { computeDecryptionShares } from '../services/trustee.js';

const props = defineProps<{ id: string }>();

const agenda = ref<Agenda | null>(null);
const aggregate = ref<{ optionId: string; c1: string; c2: string }[] | null>(null);
const existingShares = ref<TrusteeDecryptionShare[]>([]);
const error = ref('');
const info = ref('');
const busy = ref(false);

const trusteeIndex = ref<number | null>(null);
const secretShareHex = ref('');

onMounted(async () => {
  try {
    agenda.value = await api.getAgenda(props.id);
    aggregate.value = (await api.getAggregate(props.id)).options;
    existingShares.value = (await api.listDecryptionShares(props.id)).shares;
  } catch (e) {
    error.value = (e as Error).message;
  }
});

const submittedIndices = computed(() => {
  const perTrustee = new Map<number, Set<string>>();
  for (const s of existingShares.value) {
    const bag = perTrustee.get(s.trusteeIndex) ?? new Set<string>();
    bag.add(s.optionId);
    perTrustee.set(s.trusteeIndex, bag);
  }
  return perTrustee;
});

function labelFor(optionId: string): string {
  return agenda.value?.options.find((o) => o.id === optionId)?.label ?? optionId;
}

async function submitShares(): Promise<void> {
  if (!session.isLoggedIn.value) {
    error.value = 'please sign in first';
    return;
  }
  if (!agenda.value || !aggregate.value) return;
  if (trusteeIndex.value === null) {
    error.value = 'pick your trustee index';
    return;
  }
  if (!secretShareHex.value.trim()) {
    error.value = 'paste your secret share';
    return;
  }
  busy.value = true;
  error.value = '';
  info.value = '';
  try {
    const shares = computeDecryptionShares(
      agenda.value,
      trusteeIndex.value,
      secretShareHex.value.trim(),
      aggregate.value,
    );
    for (const { share } of shares) {
      await api.submitDecryptionShare(share);
    }
    info.value = `submitted ${shares.length} decryption share(s)`;
    secretShareHex.value = '';
    existingShares.value = (await api.listDecryptionShares(props.id)).shares;
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
    <h1>{{ agenda.title }} — trustee panel</h1>
    <p class="muted">
      status: <code>{{ agenda.status }}</code> · threshold
      <code>{{ agenda.key.threshold }}-of-{{ agenda.key.n }}</code>
    </p>

    <div v-if="agenda.status !== 'closed' && agenda.status !== 'tallied'">
      <p class="muted">
        the agenda must be closed before trustees can submit decryption shares.
      </p>
    </div>

    <div v-else>
      <h3>your secret share</h3>
      <p class="muted">
        paste the hex-encoded secret share you were given at key-generation time.
        it never leaves this browser tab — all cryptographic operations run
        locally.
      </p>

      <div class="field">
        <label for="trusteeIndex">trustee index</label>
        <select
          id="trusteeIndex"
          v-model.number="trusteeIndex"
          :disabled="busy"
        >
          <option :value="null">—</option>
          <option v-for="t in agenda.key.trustees" :key="t.index" :value="t.index">
            trustee {{ t.index }}
            <template v-if="submittedIndices.get(t.index)?.size === agenda.options.length">
              (already submitted)
            </template>
          </option>
        </select>
      </div>

      <div class="field">
        <label for="secret">secret share (hex)</label>
        <input
          id="secret"
          v-model="secretShareHex"
          type="password"
          autocomplete="off"
          placeholder="0x…"
          :disabled="busy"
        />
      </div>

      <div class="actions">
        <button
          class="primary"
          :disabled="busy || trusteeIndex === null || !secretShareHex"
          @click="submitShares"
        >
          compute &amp; submit decryption shares
        </button>
      </div>

      <p v-if="info" class="ok">{{ info }}</p>

      <h3 style="margin-top: 2rem">shares already on the bulletin board</h3>
      <table style="width: 100%; border-collapse: collapse">
        <thead>
          <tr>
            <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">option</th>
            <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">trustees submitted</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="opt in agenda.options" :key="opt.id">
            <td style="padding: 0.5rem 0">{{ labelFor(opt.id) }}</td>
            <td style="padding: 0.5rem 0">
              {{
                existingShares
                  .filter((s) => s.optionId === opt.id)
                  .map((s) => s.trusteeIndex)
                  .sort((a, b) => a - b)
                  .join(', ') || '—'
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
