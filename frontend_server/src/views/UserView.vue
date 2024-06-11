<template>
  <v-layout>
    <v-app-bar>
      <v-img class="mx-auto" max-width="50" contain :src="logoImg"/>
      <v-spacer/>
      <v-tabs fixed-tabs>
        <v-tab to="/user/agendaList">안건 보기</v-tab>
        <v-tab to="/user/myVoted">나의 투표</v-tab>
        <!--Future feature.
        <v-tab to="/user/trending">인기 안건</v-tab>
        -->
      </v-tabs>
      <v-spacer/>
      <v-menu open-on-hover>
        <template v-slot:activator="{ props }">
          <v-btn class="md-2" prepend-icon="mdi-account" variant="plain" v-bind="props">{{ username }}</v-btn>
        </template>
        <v-list :lines="false" density="compact" nav>
          <!--Future feature.
          <v-list-item>
            <v-btn prepend-icon="mdi-cog" variant="plain">설정</v-btn>
          </v-list-item>
          -->
          <v-list-item>
            <v-btn prepend-icon="mdi-logout" variant="plain" @click="logout">로그아웃</v-btn>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main>
      <router-view></router-view>
    </v-main>
  </v-layout>

</template>

<script setup>
import {useRouter} from 'vue-router';
import logoImg from "@/assets/ovote-logo.png";
import {useAuthStore} from '@/stores/auth-store.js';

const router = useRouter();
const auth = useAuthStore();

const username = auth.getDisplayName;

const logout = () => {
  auth.logout();
  router.push('/'); // Redirect to homepage after logout
};
</script>
