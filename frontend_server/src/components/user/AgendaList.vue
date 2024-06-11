<template>
  <v-data-table :headers="headers" :items="agendas" :sort-by="[{ key: 'createdAt', order: 'desc' }]">
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>안건 목록</v-toolbar-title>
        <v-spacer />
        <!-- Future feature.
        <v-text-field label="검색" append-inner-icon="mdi-magnify" clearable density="compact" variant="outlined"
          hide-details single-line @click:append-inner=""></v-text-field>
          -->
        <v-spacer />
        <v-btn color="primary" @click="refresh">새로고침</v-btn>
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
        <td>{{ checkVoted(item._id) }}</td>
        <td>{{ status(item) }}</td>
        <td>
          <v-icon class="me-2" icon="mdi-vote" @click="goVote(item)" />
          <v-icon class="me-2" icon="mdi-chart-box" @click="showResult(item)" />
        </td>
      </tr>
    </template>
  </v-data-table>

  <!-- Dialog for voting -->
  <v-dialog v-model="dialogVote" max-width="500px">
    <v-card>
      <v-card-item>
        <v-card-title>{{ voteTitle }}</v-card-title>
      </v-card-item>
      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="agenda.title" label="안건 이름" density="compact" variant="outlined" readonly />
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="agenda.description" label="설명" density="compact" variant="outlined" readonly />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="agenda.startTime" type="datetime-local" label="시작 시간" density="compact" readonly
              variant="outlined" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="agenda.endTime" type="datetime-local" density="compact" variant="outlined" readonly
              label="종료 시간" />
          </v-col>
        </v-row>
        <v-divider class="my-4"></v-divider>
        <v-row>
          <v-form @submit.prevent="submit">
            <v-col>
              <v-radio-group v-model="select" row>
                <v-radio v-for="(option, index) in agenda.options" :key="index" :label="`${option.option}`"
                  :value="index"></v-radio>
              </v-radio-group>
            </v-col>
          </v-form>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" text @click="closeVoteDialog">취소</v-btn>
        <v-btn color="blue-darken-1" text @click="submit">제출하기</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

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
          <v-col cols="4">
            <v-text-field label="총 표수" density="compact" readonly variant="outlined" v-model="sumVotes" />
          </v-col>
          <v-col cols="5">
            <v-text-field label="검증상태" density="compact" readonly variant="outlined" v-model="verifyResult" />
          </v-col>
          <v-col cols="3">
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
import { ref, computed, onMounted } from 'vue';
import { useAgendaStore } from '@/stores/agenda-store.js';
import { useAuthStore } from '@/stores/auth-store.js';
import moment from 'moment';
import axios from 'axios';

const authStore = useAuthStore();
const agendaStore = useAgendaStore();
const agendas = ref([]);

// Fetch agendas on component mount
onMounted(async () => {
  await refresh();
});

const refresh = async () => {
  await agendaStore.fetchAgendas();
  agendas.value = agendaStore.allAgendas;
};

// Dialog visibility control
const dialogVote = ref(false);
const dialogResult = ref(false);

// utility functions
const formatDate = (date) => {
  return moment(date).format('YYYY.MM.DD HH:mm:ss');
};

const formatDateISO = (date) => {
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

// headers for the agenda table
const headers = [
  { title: '생성 시각', key: 'createdAt' },
  { title: '투표 이름', key: 'title' },
  { title: '시작 시간', key: 'startTime' },
  { title: '종료 시간', key: 'endTime' },
  { title: '투표 여부', key: 'voted' },
  { title: '상태', key: 'status' },
  { title: '투표 / 결과', key: 'actions', sortable: false },
];

// ---------------------------Vote related functions---------------------------
const agenda = ref({});
const select = ref(null);

const voteTitle = computed(() => {
  return agenda.value.title + ' - 투표 하기';
});

const goVote = (item) => {
  const now = new Date();
  if (checkVoted(item._id) === '투표 완료') {
    alert('이미 투표한 안건입니다.');
    return;
  }
  if (now < new Date(item.startTime) || now > new Date(item.endTime)) {
    alert('현재 투표할 수 없는 안건입니다.');
    return;
  }
  const itemCopy = { ...item };
  itemCopy.startTime = formatDateISO(new Date(item.startTime));
  itemCopy.endTime = formatDateISO(new Date(item.endTime));
  Object.assign(agenda.value, itemCopy);

  select.value = null;
  dialogVote.value = true;
};

const checkVoted = (_id) => {
  const voted = authStore.getVotedAgendas || [];
  return voted.includes(_id) ? '투표 완료' : '투표 전';
};

const submit = async () => {
  const userId = authStore.getId;
  const agendaId = agenda.value._id.toString();
  const selectedOption = agenda.value.options[select.value].option;

  try {
    if (select.value !== null) {
      const response = await axios.post('/api/records', { userId, agendaId, selectedOption });
      console.log(response.data)

      if (response.data) {
        authStore.$patch({ user: response.data });
        dialogVote.value = false;
        refresh();
      }
    } else {
      console.log('옵션이 선택되지 않았습니다.');
    }
  } catch (err) {
    console.log(err);
  }
};

const closeVoteDialog = () => {
  agenda.value = {};
  select.value = null;
  dialogVote.value = false;
};

// ---------------------------Result related functions---------------------------
// Holds the agenda being viewed for results.
const resultAgenda = ref({});

const resultTitle = computed(() => {
  return resultAgenda.value.title + ' - ' + resultStatus.value + ' - 결과';
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
  resultAgenda.value = formattedAgenda;
  dialogResult.value = true;
};

const verify = async () => {
  const agenda = resultAgenda.value;
  try {
    const response = await axios.get(`/api/agendas/verify/${agenda._id}`, { params: { force: true } });
    verifyResult.value = response.data ? '일치' : '불일치';
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

</script>
