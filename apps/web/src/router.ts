import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import AgendaList from './views/AgendaList.vue';
import AgendaVote from './views/AgendaVote.vue';
import AgendaResult from './views/AgendaResult.vue';
import AgendaTrustee from './views/AgendaTrustee.vue';
import AdminLayout from './views/admin/AdminLayout.vue';
import AdminAgendas from './views/admin/AdminAgendas.vue';
import AdminAgendaNew from './views/admin/AdminAgendaNew.vue';
import AdminAgendaDetail from './views/admin/AdminAgendaDetail.vue';
import AdminUsers from './views/admin/AdminUsers.vue';
import { session } from './services/session.js';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/agendas' },
    { path: '/login', component: Login, name: 'login' },
    { path: '/agendas', component: AgendaList, name: 'agendas' },
    { path: '/agendas/:id/vote', component: AgendaVote, name: 'agenda-vote', props: true },
    { path: '/agendas/:id/result', component: AgendaResult, name: 'agenda-result', props: true },
    { path: '/agendas/:id/trustee', component: AgendaTrustee, name: 'agenda-trustee', props: true },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin/agendas' },
        { path: 'agendas', component: AdminAgendas, name: 'admin-agendas' },
        { path: 'agendas/new', component: AdminAgendaNew, name: 'admin-agenda-new' },
        {
          path: 'agendas/:id',
          component: AdminAgendaDetail,
          name: 'admin-agenda-detail',
          props: true,
        },
        { path: 'users', component: AdminUsers, name: 'admin-users' },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.requiresAdmin) return true;
  if (!session.isLoggedIn.value) return { name: 'login' };
  if (session.voter.value?.role !== 'admin') return { name: 'agendas' };
  return true;
});
