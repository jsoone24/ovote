<template>
  <v-container>
    <v-form>
      <div class="text-subtitle-1 text-medium-emphasis">이메일</div>
      <v-text-field density="compact" placeholder="" prepend-inner-icon="mdi-email-outline" variant="outlined"
        v-model="email"></v-text-field>
      <div class="text-subtitle-1 text-medium-emphasis d-flex align-center justify-space-between">
        비밀번호
        <a class="text-caption text-decoration-none text-blue">
          비밀번호 찾기
        </a>
      </div>
      <v-text-field :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'" :type="visible ? 'text' : 'password'"
        density="compact" placeholder="" prepend-inner-icon="mdi-lock-outline" variant="outlined"
        @click:append-inner="visible = !visible" v-model="password"></v-text-field>
      <v-btn color="blue" size="large" variant="tonal" block @click="login">로그인</v-btn>
    </v-form>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth-store.js';

const visible = ref(false);

const email = ref('');
const password = ref('');
const authStore = useAuthStore();
const router = useRouter();

const login = async () => {
  try {
    await authStore.login({ email: email.value, password: password.value });
    if (authStore.user.role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/user');
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};
</script>

<style scoped></style>
