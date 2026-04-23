<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div>
    <nav class="admin-nav">
      <RouterLink :to="{ name: 'admin-agendas' }" active-class="active">agendas</RouterLink>
      <RouterLink :to="{ name: 'admin-users' }" active-class="active">users</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.admin-nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.admin-nav a {
  color: var(--muted);
  padding-bottom: 0.5rem;
  margin-bottom: -0.5rem;
  border-bottom: 2px solid transparent;
}
.admin-nav a.active {
  color: var(--fg);
  border-bottom-color: var(--accent);
}
</style>
