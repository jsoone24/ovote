<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Agenda } from '@ovote/shared';
import { api } from '../../api.js';

const agendas = ref<Agenda[]>([]);
const error = ref('');

async function load(): Promise<void> {
  try {
    agendas.value = (await api.listAgendas()).agendas;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(load);

function badgeClass(status: string): string {
  return `status status-${status}`;
}
</script>

<template>
  <div class="panel">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem">
      <h1 style="margin: 0">agendas</h1>
      <RouterLink :to="{ name: 'admin-agenda-new' }">
        <button class="primary">+ new agenda</button>
      </RouterLink>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!error && agendas.length === 0" class="muted">none yet.</p>

    <ul style="list-style: none; padding: 0">
      <li v-for="a in agendas" :key="a.id" class="option-row">
        <div style="flex: 1">
          <RouterLink :to="{ name: 'admin-agenda-detail', params: { id: a.id } }">
            <strong>{{ a.title }}</strong>
          </RouterLink>
          <div class="muted">{{ a.description || '—' }}</div>
          <div class="muted" style="font-size: 0.85em">
            opens {{ new Date(a.openAt).toLocaleString() }} · closes {{ new Date(a.closeAt).toLocaleString() }}
          </div>
        </div>
        <span :class="badgeClass(a.status)">{{ a.status }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.status {
  font-size: 0.8em;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.status-draft { color: var(--muted); }
.status-open { color: var(--ok); border-color: var(--ok); }
.status-closed { color: var(--accent); border-color: var(--accent); }
.status-tallied { color: var(--fg); border-color: var(--fg); }
</style>
