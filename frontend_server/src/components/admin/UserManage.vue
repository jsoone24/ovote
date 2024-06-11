<template>
  <v-data-table :headers="headers" :items="users" :sort-by="[{ key: 'name', order: 'desc' }]">
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>사용자 목록</v-toolbar-title>
        <v-spacer />
        <v-btn color="primary" @click="refresh">새로고침</v-btn>
      </v-toolbar>
    </template>
    <template v-slot:no-data>
      <div>데이터 없음</div>
    </template>
    <template v-slot:item="{ item }">
      <tr>
        <td>{{ item.name }}</td>
        <td>{{ item.email }}</td>
        <td>{{ item.organization }}</td>
        <td>{{ item.role }}</td>
      </tr>
    </template>
  </v-data-table>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from "@/stores/user-store.js";

const userStore = useUserStore();
const users = ref([]);

// Fetch users on component mount
onMounted(async () => {
  await refresh();
});

const refresh = async () => {
  await userStore.fetchUsers();
  users.value = userStore.allUsers;
};

// headers for the user table
const headers = ref([
  { title: '사용자 이름', key: 'name' },
  { title: '이메일', key: 'email' },
  { title: '기관', key: 'organization' },
  { title: '역할', key: 'role' }
]);

</script>