import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import AgendaList from './views/AgendaList.vue';
import AgendaVote from './views/AgendaVote.vue';
import AgendaResult from './views/AgendaResult.vue';
import AgendaTrustee from './views/AgendaTrustee.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/agendas' },
    { path: '/login', component: Login, name: 'login' },
    { path: '/agendas', component: AgendaList, name: 'agendas' },
    { path: '/agendas/:id/vote', component: AgendaVote, name: 'agenda-vote', props: true },
    { path: '/agendas/:id/result', component: AgendaResult, name: 'agenda-result', props: true },
    { path: '/agendas/:id/trustee', component: AgendaTrustee, name: 'agenda-trustee', props: true },
  ],
});
