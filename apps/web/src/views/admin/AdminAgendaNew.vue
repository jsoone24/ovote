<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Ristretto, Threshold } from '@ovote/crypto';
import { api } from '../../api.js';

const router = useRouter();

interface OptionRow {
  id: string;
  label: string;
}

const form = reactive({
  title: '',
  description: '',
  openAt: defaultOpenAt(),
  closeAt: defaultCloseAt(),
  options: [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ] as OptionRow[],
  threshold: 2,
  n: 3,
});

const busy = ref(false);
const error = ref('');

// Once generated, the secret shares are shown to the admin exactly once so
// they can be distributed to trustees out-of-band. The shares themselves
// never touch the server.
const generated = ref<{
  groupPk: string;
  threshold: number;
  n: number;
  trustees: { index: number; pkB64: string; skHex: string }[];
} | null>(null);

const createdAgenda = ref<{ id: string } | null>(null);

function addOption(): void {
  form.options.push({ id: `opt${form.options.length + 1}`, label: '' });
}

function removeOption(i: number): void {
  if (form.options.length > 2) form.options.splice(i, 1);
}

function defaultOpenAt(): string {
  // <input type="datetime-local"> wants a local ISO-ish string without tz.
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  return toLocalInputValue(d);
}

function defaultCloseAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalInputValue(d);
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string): string {
  return new Date(v).toISOString();
}

function bigIntToHex(b: bigint): string {
  let h = b.toString(16);
  if (h.length % 2) h = '0' + h;
  return h.padStart(64, '0');
}

const canGenerate = computed(() =>
  !!form.title.trim() &&
  form.options.every((o) => o.id.trim() && o.label.trim()) &&
  new Set(form.options.map((o) => o.id.trim())).size === form.options.length &&
  form.threshold >= 1 && form.threshold <= form.n && form.n >= 1,
);

function generateKey(): void {
  error.value = '';
  try {
    const out = Threshold.trustedDealerKeygen(form.threshold, form.n);
    generated.value = {
      groupPk: Ristretto.pointToB64Url(out.publicParams.groupPk),
      threshold: out.publicParams.threshold,
      n: out.publicParams.n,
      trustees: out.shares.map((s) => ({
        index: s.index,
        pkB64: Ristretto.pointToB64Url(s.pk),
        skHex: bigIntToHex(s.sk),
      })),
    };
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function createAgenda(): Promise<void> {
  if (!generated.value) return;
  busy.value = true;
  error.value = '';
  try {
    const agenda = await api.createAgenda({
      title: form.title.trim(),
      description: form.description.trim(),
      openAt: localInputToIso(form.openAt),
      closeAt: localInputToIso(form.closeAt),
      options: form.options.map((o) => ({ id: o.id.trim(), label: o.label.trim() })),
      key: {
        groupPk: generated.value.groupPk,
        threshold: generated.value.threshold,
        n: generated.value.n,
        trustees: generated.value.trustees.map((t) => ({ index: t.index, pk: t.pkB64 })),
      },
    });
    createdAgenda.value = { id: agenda.id };
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function copy(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function goToDetail(): void {
  if (createdAgenda.value) {
    router.push({ name: 'admin-agenda-detail', params: { id: createdAgenda.value.id } });
  }
}
</script>

<template>
  <div class="panel">
    <h1>new agenda</h1>
    <RouterLink :to="{ name: 'admin-agendas' }" class="muted">← back</RouterLink>

    <div v-if="createdAgenda" style="margin-top: 1rem">
      <p class="ok">agenda created.</p>
      <p class="muted">
        if you haven't distributed the trustee secret shares yet, do it now — they are
        <strong>not</strong> stored anywhere and this page is the only copy.
      </p>
      <button class="primary" @click="goToDetail">open agenda detail</button>
    </div>

    <template v-else-if="generated">
      <h3 style="margin-top: 1.5rem">trustee secret shares — distribute now</h3>
      <p class="muted">
        each row is meant for one trustee. copy the <code>secret share (hex)</code>
        into a secure channel for that trustee. they will paste it into the
        trustee panel at decryption time.
        <strong>once you click "create agenda" this page won't be shown again.</strong>
      </p>

      <table class="trustee-table">
        <thead>
          <tr>
            <th>#</th>
            <th>public share (goes on-chain)</th>
            <th>secret share (hex) — GIVE TO TRUSTEE #n</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in generated.trustees" :key="t.index">
            <td>{{ t.index }}</td>
            <td class="mono">{{ t.pkB64.slice(0, 12) }}…</td>
            <td>
              <code class="mono">{{ t.skHex }}</code>
              <button style="margin-left: 0.5rem" @click="copy(t.skHex)">copy</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="actions">
        <button :disabled="busy" class="primary" @click="createAgenda">create agenda</button>
        <button :disabled="busy" @click="generated = null">back to form</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </template>

    <template v-else>
      <div class="field">
        <label for="title">title</label>
        <input id="title" v-model="form.title" placeholder="Board election 2026" />
      </div>

      <div class="field">
        <label for="desc">description</label>
        <input id="desc" v-model="form.description" />
      </div>

      <div style="display: flex; gap: 1rem">
        <div class="field" style="flex: 1">
          <label for="openAt">opens at (local)</label>
          <input id="openAt" v-model="form.openAt" type="datetime-local" />
        </div>
        <div class="field" style="flex: 1">
          <label for="closeAt">closes at (local)</label>
          <input id="closeAt" v-model="form.closeAt" type="datetime-local" />
        </div>
      </div>

      <h3>options</h3>
      <div v-for="(opt, i) in form.options" :key="i" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem">
        <input v-model="opt.id" placeholder="id (stable key)" style="flex: 1" />
        <input v-model="opt.label" placeholder="label (shown to voter)" style="flex: 2" />
        <button :disabled="form.options.length <= 2" @click="removeOption(i)">−</button>
      </div>
      <button @click="addOption">+ add option</button>

      <h3 style="margin-top: 1.5rem">trustees</h3>
      <p class="muted">
        pick a <em>t-of-n</em> threshold. any <code>t</code> trustees must
        cooperate to decrypt the tally. typical: 2-of-3 or 3-of-5.
      </p>
      <div style="display: flex; gap: 1rem">
        <div class="field" style="flex: 1">
          <label for="t">threshold (t)</label>
          <input id="t" v-model.number="form.threshold" type="number" min="1" />
        </div>
        <div class="field" style="flex: 1">
          <label for="n">total (n)</label>
          <input id="n" v-model.number="form.n" type="number" min="1" />
        </div>
      </div>

      <div class="actions">
        <button :disabled="!canGenerate" class="primary" @click="generateKey">
          generate trustee keys
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.trustee-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.trustee-table th,
.trustee-table td {
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  word-break: break-all;
}
</style>
