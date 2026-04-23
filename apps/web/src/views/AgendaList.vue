<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Agenda } from '@ovote/shared';
import { api } from '../api.js';
import { session } from '../services/session.js';

const agendas = ref<Agenda[]>([]);
const error = ref('');
const router = useRouter();

onMounted(async () => {
  try {
    const res = await api.listAgendas();
    agendas.value = res.agendas;
  } catch (e) {
    error.value = (e as Error).message;
  }
});

function go(a: Agenda): void {
  if (a.status === 'tallied') router.push({ name: 'agenda-result', params: { id: a.id } });
  else if (a.status === 'open') router.push({ name: 'agenda-vote', params: { id: a.id } });
}

function goTrustee(a: Agenda): void {
  router.push({ name: 'agenda-trustee', params: { id: a.id } });
}

const isTrustee = session.voter.value?.role === 'trustee';
</script>

<template>
  <div class="panel">
    <h1>agendas</h1>
    <p v-if="!session.isLoggedIn.value" class="muted">
      <RouterLink :to="{ name: 'login' }">sign in</RouterLink> to cast a ballot.
    </p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!error && agendas.length === 0" class="muted">no agendas yet.</p>

    <ul style="list-style: none; padding: 0">
      <li v-for="a in agendas" :key="a.id" class="option-row">
        <div style="flex: 1">
          <strong>{{ a.title }}</strong>
          <div class="muted">{{ a.description }}</div>
          <div class="muted">
            <code>{{ a.status }}</code> · opens {{ new Date(a.openAt).toLocaleString() }} · closes {{ new Date(a.closeAt).toLocaleString() }}
          </div>
        </div>
        <button v-if="a.status === 'open'" class="primary" @click="go(a)">vote</button>
        <button v-else-if="a.status === 'tallied'" @click="go(a)">result</button>
        <span v-else class="muted">{{ a.status }}</span>
        <button
          v-if="isTrustee && (a.status === 'closed' || a.status === 'tallied')"
          @click="goTrustee(a)"
        >
          trustee
        </button>
      </li>
    </ul>
  </div>
</template>
