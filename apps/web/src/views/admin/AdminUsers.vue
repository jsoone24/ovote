<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../../api.js';

type Role = 'voter' | 'admin' | 'trustee';
interface Voter {
  id: string;
  email: string;
  role: Role;
}

const voters = ref<Voter[]>([]);
const error = ref('');
const info = ref('');
const busy = ref(false);

async function load(): Promise<void> {
  error.value = '';
  try {
    voters.value = (await api.listVoters()).voters;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(load);

async function setRole(v: Voter, role: Role): Promise<void> {
  if (v.role === role) return;
  busy.value = true;
  error.value = '';
  info.value = '';
  try {
    await api.setVoterRole(v.email, role);
    info.value = `${v.email} → ${role}`;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="panel">
    <h1>users</h1>
    <p class="muted">
      voters sign up automatically on first OTP login. this page lets admins
      grant or revoke <code>admin</code> / <code>trustee</code> roles.
    </p>
    <p v-if="info" class="ok">{{ info }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <table style="width: 100%; border-collapse: collapse">
      <thead>
        <tr>
          <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">email</th>
          <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">role</th>
          <th style="text-align: right; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">change</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in voters" :key="v.id">
          <td style="padding: 0.5rem 0">{{ v.email }}</td>
          <td style="padding: 0.5rem 0"><code>{{ v.role }}</code></td>
          <td style="padding: 0.5rem 0; text-align: right">
            <button
              v-for="r in (['voter', 'admin', 'trustee'] as const)"
              :key="r"
              :class="{ primary: v.role === r }"
              :disabled="busy || v.role === r"
              style="margin-left: 0.35rem"
              @click="setRole(v, r)"
            >
              {{ r }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
