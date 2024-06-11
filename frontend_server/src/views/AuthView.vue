<template>
  <v-container class="fill-height">
    <v-sheet class="mx-auto d-flex" fluid elevation="8" rounded="lg" min-width="600" min-height="500">
      <v-row class="ma-1" dense>
        <v-col class="text-center mx-auto d-flex flex-column" cols="6">
          <v-img class="ma-5" :src="logoImg"></v-img>
          <v-card-title>환영합니다</v-card-title>
          <v-card-text> 블록체인 전자투표시스템</v-card-text>
        </v-col>
        <v-divider vertical/>
        <v-col cols="6" class="d-flex flex-column">
          <v-tabs fixed-tabs v-model="currentTab">
            <v-tab value="login" to="/">로그인</v-tab>
            <v-tab value="signUp" to="/signUp">회원가입</v-tab>
          </v-tabs>
          <router-view></router-view>
        </v-col>
      </v-row>
    </v-sheet>
  </v-container>
</template>

<script setup>
import {ref, watch} from 'vue';
import {useRoute} from 'vue-router';
import logoImg from "@/assets/ovote-logo.png";

const route = useRoute();
const currentTab = ref(route.meta.tab || 'login');

watch(() => route.meta.tab, (newTab) => {
  currentTab.value = newTab;
});

</script>

<style scoped></style>
