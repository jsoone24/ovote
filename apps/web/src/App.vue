<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { session } from './services/session.js';

const router = useRouter();
const isAdmin = computed(() => session.voter.value?.role === 'admin');

function logout(): void {
  session.clear();
  router.push({ name: 'login' });
}
</script>

<template>
  <header>
    <RouterLink :to="{ name: 'agendas' }" style="color: var(--fg)"><strong>ovote</strong></RouterLink>
    <nav style="display: flex; gap: 1rem; align-items: center">
      <template v-if="session.isLoggedIn.value">
        <RouterLink v-if="isAdmin" :to="{ name: 'admin-agendas' }">admin</RouterLink>
        <span class="muted">{{ session.voter.value?.email }} · {{ session.voter.value?.role }}</span>
        <button @click="logout">sign out</button>
      </template>
      <RouterLink v-else :to="{ name: 'login' }">sign in</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
