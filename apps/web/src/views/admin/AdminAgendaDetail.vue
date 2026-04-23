<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Agenda, TrusteeDecryptionShare } from '@ovote/shared';
import { api } from '../../api.js';

const props = defineProps<{ id: string }>();

const agenda = ref<Agenda | null>(null);
const eligibility = ref<{ voterId: string; email: string }[]>([]);
const shares = ref<TrusteeDecryptionShare[]>([]);
const newEmails = ref('');
const busy = ref(false);
const error = ref('');
const info = ref('');

async function load(): Promise<void> {
  error.value = '';
  try {
    agenda.value = await api.getAgenda(props.id);
    eligibility.value = (await api.listEligibility(props.id)).voters;
    if (agenda.value.status === 'closed' || agenda.value.status === 'tallied') {
      shares.value = (await api.listDecryptionShares(props.id)).shares;
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(load);

const parsedEmails = computed(() =>
  newEmails.value
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean),
);

async function addEligibility(): Promise<void> {
  if (parsedEmails.value.length === 0) return;
  busy.value = true;
  error.value = '';
  info.value = '';
  try {
    const res = await api.setEligibility(props.id, parsedEmails.value);
    info.value = `added ${res.added} voter(s)`;
    newEmails.value = '';
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function runAction(fn: () => Promise<unknown>, label: string): Promise<void> {
  busy.value = true;
  error.value = '';
  info.value = '';
  try {
    await fn();
    info.value = label;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

const openAction = () => runAction(() => api.openAgenda(props.id), 'agenda opened');
const closeAction = () => runAction(() => api.closeAgenda(props.id), 'agenda closed');
const publishAction = () => runAction(() => api.publishResult(props.id), 'tally published');

const sharesPerTrustee = computed(() => {
  const m = new Map<number, number>();
  for (const s of shares.value) m.set(s.trusteeIndex, (m.get(s.trusteeIndex) ?? 0) + 1);
  return m;
});

const hasQuorum = computed(() => {
  if (!agenda.value) return false;
  const byOption = new Map<string, number>();
  for (const s of shares.value) byOption.set(s.optionId, (byOption.get(s.optionId) ?? 0) + 1);
  return agenda.value.options.every((o) => (byOption.get(o.id) ?? 0) >= agenda.value!.key.threshold);
});
</script>

<template>
  <div v-if="!agenda" class="panel">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else class="muted">loading…</p>
  </div>

  <template v-else>
    <div class="panel">
      <RouterLink :to="{ name: 'admin-agendas' }" class="muted">← back</RouterLink>
      <h1>{{ agenda.title }}</h1>
      <p class="muted">{{ agenda.description || '—' }}</p>
      <p>
        status: <code>{{ agenda.status }}</code> ·
        opens {{ new Date(agenda.openAt).toLocaleString() }} ·
        closes {{ new Date(agenda.closeAt).toLocaleString() }}
      </p>
      <p class="muted">
        options: {{ agenda.options.map((o) => o.label).join(', ') }}
      </p>
      <p class="muted">
        threshold: <code>{{ agenda.key.threshold }}-of-{{ agenda.key.n }}</code>
      </p>

      <div class="actions">
        <button v-if="agenda.status === 'draft'" :disabled="busy" class="primary" @click="openAction">
          open voting
        </button>
        <button v-if="agenda.status === 'open'" :disabled="busy" class="danger" @click="closeAction">
          close voting
        </button>
        <button
          v-if="agenda.status === 'closed'"
          :disabled="busy || !hasQuorum"
          class="primary"
          @click="publishAction"
        >
          publish tally
        </button>
        <RouterLink
          v-if="agenda.status === 'tallied'"
          :to="{ name: 'agenda-result', params: { id: agenda.id } }"
        >
          <button>view result</button>
        </RouterLink>
      </div>
      <p v-if="agenda.status === 'closed' && !hasQuorum" class="muted">
        waiting for trustee quorum ({{ agenda.key.threshold }} of {{ agenda.key.n }}) before the tally can be published.
      </p>
      <p v-if="info" class="ok">{{ info }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <div class="panel">
      <h2>eligibility roster</h2>
      <p v-if="agenda.status !== 'draft'" class="muted">
        frozen — can only be edited while the agenda is draft.
      </p>
      <template v-else>
        <p class="muted">
          paste emails separated by comma, space, or newline. a voter added here
          will be able to pick up one blind-signed credential for this agenda.
        </p>
        <textarea
          v-model="newEmails"
          rows="3"
          placeholder="alice@org.test, bob@org.test"
          style="font-family: ui-monospace, monospace"
        ></textarea>
        <div class="actions">
          <button :disabled="busy || parsedEmails.length === 0" class="primary" @click="addEligibility">
            add {{ parsedEmails.length || '' }} voter{{ parsedEmails.length === 1 ? '' : 's' }}
          </button>
        </div>
      </template>

      <h3 style="margin-top: 1rem">current roster ({{ eligibility.length }})</h3>
      <ul v-if="eligibility.length" style="padding-left: 1rem">
        <li v-for="v in eligibility" :key="v.voterId">{{ v.email }}</li>
      </ul>
      <p v-else class="muted">none yet.</p>
    </div>

    <div v-if="agenda.status === 'closed' || agenda.status === 'tallied'" class="panel">
      <h2>trustee progress</h2>
      <table style="width: 100%; border-collapse: collapse">
        <thead>
          <tr>
            <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">trustee</th>
            <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">submitted shares</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in agenda.key.trustees" :key="t.index">
            <td style="padding: 0.5rem 0">#{{ t.index }}</td>
            <td style="padding: 0.5rem 0">
              {{ sharesPerTrustee.get(t.index) ?? 0 }} / {{ agenda.options.length }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
