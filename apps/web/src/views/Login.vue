<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { session } from '../services/session.js';

const email = ref('');
const code = ref('');
const stage = ref<'email' | 'code'>('email');
const error = ref('');
const busy = ref(false);
const router = useRouter();

async function requestOtp(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    await api.requestOtp(email.value);
    stage.value = 'code';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function verifyOtp(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const res = await api.verifyOtp(email.value, code.value);
    session.set({ token: res.sessionToken, voter: res.voter });
    router.push({ name: 'agendas' });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="panel">
    <h1>sign in</h1>
    <p class="muted">we'll email a one-time code to your inbox.</p>

    <div v-if="stage === 'email'">
      <div class="field">
        <label for="email">email</label>
        <input id="email" v-model="email" type="email" autocomplete="email" />
      </div>
      <div class="actions">
        <button class="primary" :disabled="busy || !email" @click="requestOtp">send code</button>
      </div>
    </div>

    <div v-else>
      <p>code sent to <code>{{ email }}</code>.</p>
      <div class="field">
        <label for="code">6-digit code</label>
        <input id="code" v-model="code" inputmode="numeric" maxlength="6" />
      </div>
      <div class="actions">
        <button class="primary" :disabled="busy || code.length !== 6" @click="verifyOtp">verify</button>
        <button :disabled="busy" @click="stage = 'email'">back</button>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
