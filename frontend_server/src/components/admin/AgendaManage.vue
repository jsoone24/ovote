<template>
  <v-data-table :headers="headers" :items="agendas" :sort-by="[{ key: 'createdAt', order: 'desc' }]">
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>안건 목록</v-toolbar-title>
        <v-spacer />
        <!-- Future feature. Search bar
        <v-text-field label="검색" append-inner-icon="mdi-magnify" clearable density="compact" variant="outlined"
          hide-details single-line @click:append-inner=""></v-text-field>
          -->
        <v-spacer />
        <v-btn color="primary" @click="refresh">새로고침</v-btn>
        <v-btn color="primary" @click="openDialog">새 안건 생성</v-btn>
      </v-toolbar>
    </template>
    <template v-slot:no-data>
      <div>데이터 없음</div>
    </template>
    <template v-slot:item="{ item }">
      <tr>
        <td>{{ formatDate(item.createdAt) }}</td>
        <td>{{ item.title }}</td>
        <td>{{ formatDate(item.startTime) }}</td>
        <td>{{ formatDate(item.endTime) }}</td>
        <td>{{ status(item) }}</td>
        <td>
          <v-icon class="me-2" @click="editItem(item)">mdi-pencil</v-icon>
          <v-icon class="me-2" @click="confirmDelete(item)">mdi-delete</v-icon>
          <v-icon class="me-2" @click="showResult(item)">mdi-chart-box</v-icon>
        </td>
      </tr>
    </template>
  </v-data-table>

  <!-- Dialog for creating and editing agendas -->
  <v-dialog v-model="dialog" max-width="500px">
    <v-card>
      <v-card-item>
        <v-card-title>{{ formTitle }}</v-card-title>
      </v-card-item>
      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="editedItem.title" label="안건 이름" clearable density="compact"
              variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="editedItem.description" label="설명" clearable density="compact"
              variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="editedItem.startTime" label="시작 시간" type="datetime-local" density="compact"
              variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="editedItem.endTime" label="종료 시간" type="datetime-local" density="compact"
              variant="outlined"></v-text-field>
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="newOption" label="Enter 키를 눌러 옵션 추가" @keyup.enter="addOption" clearable
              density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12">
            <v-list density="compact">
              <v-list-item v-for="(option, index) in editedItem.options" :key="index">
                <v-list-item-title>{{ option.option }}</v-list-item-title>
                <v-divider />
                <template v-slot:append>
                  <v-btn @click="removeOption(index)" icon="mdi-delete" variant="text"></v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn prepend-icon="mdi-cancel" text="취소" variant="outlined" class="ma-2" color="red" @click="closeDialog" />
        <v-btn prepend-icon="mdi-checkbox-marked-circle" text="저장" variant="outlined" class="ma-2" color="primary"
          @click="saveAgenda" />
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Dialog for deleting agendas -->
  <v-dialog v-model="dialogDelete" max-width="500px">
    <v-card>
      <v-card-title class="text-h5">안건을 삭제하시겠습니까?</v-card-title>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" @click="closeDelete">취소</v-btn>
        <v-btn color="blue-darken-1" @click="deleteItemConfirm">삭제</v-btn>
        <v-spacer></v-spacer>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Dialog for viewing results -->
  <v-dialog v-model="dialogResult" max-width="500px">
    <v-card>
      <v-card-item>
        <v-card-title>{{ resultTitle }}</v-card-title>
      </v-card-item>
      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="resultAgenda.description" label="설명" density="compact" variant="outlined" readonly />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="resultAgenda.startTime" type="datetime-local" label="시작 시간" density="compact"
              readonly variant="outlined" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="resultAgenda.endTime" type="datetime-local" density="compact" variant="outlined"
              readonly label="종료 시간" />
          </v-col>
          <v-col cols="3">
            <v-text-field label="상태" density="compact" readonly variant="outlined" v-model="resultStatus" />
          </v-col>
          <v-col cols="3">
            <v-text-field label="총 표수" density="compact" readonly variant="outlined" v-model="sumVotes" />
          </v-col>
          <v-col cols="4">
            <v-text-field label="검증상태" density="compact" readonly variant="outlined" v-model="verifyResult" />
          </v-col>
          <v-col cols="2">
            <v-btn class="btn btn-primary" @click="verify" text="검증하기" />
          </v-col>
          <v-col cols="12">
            <v-table>
              <thead>
                <tr>
                  <th>내용</th>
                  <th>득표수</th>
                  <th>득표율</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(option, index) in resultAgenda.options" :key="index">
                  <td>{{ option.option }}</td>
                  <td>{{ option.votes }}</td>
                  <td>{{ sumVotes > 0 ? ((option.votes / sumVotes) * 100).toFixed(2) + '%' : '0%' }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" @click="closeResult">닫기</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAgendaStore } from '@/stores/agenda-store.js';
import { useAuthStore } from "@/stores/auth-store.js";
import moment from 'moment';
import axios from 'axios';

const authStore = useAuthStore();
const agendaStore = useAgendaStore();
const agendas = ref([]);
const editedIndex = ref(-1);

// Fetch agendas on component mount
onMounted(async () => {
  await refresh();
});

const refresh = async () => {
  await agendaStore.fetchAgendas();
  agendas.value = agendaStore.allAgendas;
};

// Dialog visibility control
const dialog = ref(false);
const dialogDelete = ref(false);
const dialogResult = ref(false);

// utility functions
const formatDate = (date) => {
  return moment(date).format('YYYY.MM.DD HH:mm:ss');
};

const formatDateISO = (date) => {
  // input type new Date()
  const timezoneOffsetInMinutes = new Date().getTimezoneOffset();
  return (new Date(date - timezoneOffsetInMinutes * 60000)).toISOString().slice(0, 16);
}

const status = (agenda) => {
  const now = new Date();
  const start = new Date(agenda.startTime);
  const end = new Date(agenda.endTime);
  if (now < start) {
    return '예정';
  } else if (now < end) {
    return '진행중';
  } else {
    return '종료';
  }
};

// Default agenda template
const defaultItem = {
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  createdOrg: authStore.getOrganization,
  options: [],
};

// headers for the agenda table
const headers = ref([
  { title: '생성 시각', key: 'createdAt' },
  { title: '투표 이름', key: 'title' },
  { title: '시작 시간', key: 'startTime' },
  { title: '종료 시간', key: 'endTime' },
  { title: '상태', key: 'status' },
  { title: '수정/삭제/결과', key: 'actions', sortable: false },
]);

// ----------------------Agenda Creation, Edition related--------------------------
// Holds the current agenda being edited or created
const editedItem = ref({});
const newOption = ref('');

// formTitle: Dynamically sets the dialog title based on whether creating or editing an agenda.
const formTitle = computed(() => {
  return editedIndex.value === -1 ? '안건 생성' : '안건 수정';
});

const openDialog = () => {
  editedIndex.value = -1;
  Object.assign(editedItem.value, {
    ...defaultItem,
    options: [],
    startTime: formatDateISO(new Date()),
    endTime: formatDateISO(new Date())
  });
  dialog.value = true;
};

// agenda edit logic
const editItem = (item) => {
  const now = new Date();
  if (now > new Date(item.startTime)) {
    alert('현재 수정할 수 없는 안건입니다.');
    return;
  }
  editedIndex.value = agendas.value.indexOf(item);

  const itemCopy = { ...item };
  itemCopy.startTime = formatDateISO(new Date(item.startTime));
  itemCopy.endTime = formatDateISO(new Date(item.endTime));

  Object.assign(editedItem.value, itemCopy);
  dialog.value = true;
};

// agenda save logic
const saveAgenda = async () => {
  try {
    if (editedIndex.value > -1) {
      await agendaStore.updateAgenda(editedItem.value);
    } else {
      await agendaStore.createAgenda(editedItem.value);
    }
    agendas.value = agendaStore.allAgendas;
    closeDialog();
  } catch (error) {
    console.error('Failed to save agenda:', error);
    alert('Failed to save agenda. Please try again later.');
  }
};

// agenda option modification logic
const addOption = () => {
  const trimmedOption = newOption.value.trim();
  if (trimmedOption !== '' && !editedItem.value.options.some(option => option.option === trimmedOption)) {
    editedItem.value.options.push({ option: trimmedOption, votes: 0 });
    newOption.value = '';
  }
};

const removeOption = (index) => {
  editedItem.value.options.splice(index, 1);
};

const closeDialog = () => {
  editedItem.value = {
    ...defaultItem,
    options: []
  };
  editedIndex.value = -1;
  dialog.value = false;
};

// ----------------------Agenda Result related--------------------------
// Holds the agenda being viewed for results.
const resultAgenda = ref({});

// resultTitle: Sets the title for the result dialog.
const resultTitle = computed(() => {
  return resultAgenda.value.title + ' - 결과';
});
const verifyResult = ref('');

// result logic
const showResult = async (agenda) => {
  const formattedAgenda = {
    ...agenda,
    startTime: formatDateISO(new Date(agenda.startTime)),
    endTime: formatDateISO(new Date(agenda.endTime)),
  };
  verifyResult.value = agenda.isVerified === null ? '미검증' : (agenda.isVerified ? '일치' : '불일치');
  console.log(agenda.isVerified)
  resultAgenda.value = formattedAgenda;
  dialogResult.value = true;
};

const verify = async () => {
  const agenda = resultAgenda.value;
  try {
    const response = await axios.get(`/api/agendas/verify/${agenda._id}`, { params: { force: true } });
    verifyResult.value = response.data === null ? '미검증' : (response.data ? '일치' : '불일치');
  } catch (error) {
    verifyResult.value = '검증 실패';
  }
};

const sumVotes = computed(() => {
  return resultAgenda.value.options.reduce((sum, option) => sum + option.votes, 0);
});

const resultStatus = computed(() => {
  const now = new Date();
  if (now < new Date(resultAgenda.value.startTime)) {
    return '예정';
  } else if (now < new Date(resultAgenda.value.endTime)) {
    return '진행 중';
  } else {
    return '종료';
  }
});

const closeResult = () => {
  dialogResult.value = false;
  verifyResult.value = '';
};

// ----------------------Agenda Deletion related--------------------------
// agenda delete logic
const confirmDelete = (item) => {
  const now = new Date();
  if (now < new Date(item.startTime) || now > new Date(item.endTime)) {
    alert('현재 삭제할 수 없는 안건입니다.');
    return;
  }
  editedIndex.value = agendas.value.indexOf(item);
  dialogDelete.value = true;
};

const deleteItemConfirm = async () => {
  const id = agendas.value[editedIndex.value]._id;
  try {
    await agendaStore.deleteAgenda(id);
    agendas.value = agendaStore.allAgendas;
    closeDelete();
  } catch (error) {
    console.error('Failed to delete agenda:', error);
    alert('Failed to delete agenda. Please try again later.');
  }
};

const closeDelete = () => {
  dialogDelete.value = false;
};
</script>