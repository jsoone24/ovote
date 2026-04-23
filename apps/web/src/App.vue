<script setup lang="ts">
import { useRouter } from 'vue-router';
import { session } from './services/session.js';

const router = useRouter();

function logout(): void {
  session.clear();
  router.push({ name: 'login' });
}
</script>

<template>
  <header>
    <strong>ovote</strong>
    <nav>
      <template v-if="session.isLoggedIn.value">
        <span class="muted">{{ session.voter.value?.email }}</span>
        <button style="margin-left: 1rem" @click="logout">sign out</button>
      </template>
      <RouterLink v-else :to="{ name: 'login' }">sign in</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
