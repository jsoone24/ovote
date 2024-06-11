<template>
  <v-container>
    <v-form>
      <div class="text-subtitle-1 text-medium-emphasis">이메일</div>
      <v-text-field density="compact" prepend-inner-icon="mdi-email-outline" variant="outlined"
        v-model="email"></v-text-field>
      <div class="text-subtitle-1 text-medium-emphasis d-flex align-center justify-space-between">
        비밀번호
      </div>
      <v-text-field :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'" :type="visible ? 'text' : 'password'"
        density="compact" prepend-inner-icon="mdi-lock-outline" variant="outlined"
        @click:append-inner="visible = !visible" v-model="password"></v-text-field>
      <div class="text-subtitle-1 text-medium-emphasis">이름</div>
      <v-text-field density="compact" prepend-inner-icon="mdi-account" variant="outlined" v-model="name"></v-text-field>
      <div class="text-subtitle-1 text-medium-emphasis">기관</div>
      <v-autocomplete density="compact" prepend-inner-icon="mdi-domain" variant="outlined"
        v-model="organization" :items="organizations"/>

      <v-btn color="blue" size="large" variant="tonal" block @click="signup">회원가입하기</v-btn>
    </v-form>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth-store.js';

const visible = ref(false);

const email = ref('');
const name = ref('');
const password = ref('');
const organization = ref('');
const authStore = useAuthStore();
const router = useRouter();

const organizations =["org1"]
const signup = async () => {
  try {
    await authStore.signUp({ name: name.value, email: email.value, password: password.value, organization: organization.value });
    router.push('/');
  } catch (error) {
    console.error('Signup failed:', error);
  }
};
</script>

<style scoped></style>
