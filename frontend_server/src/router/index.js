import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth-store.js";

import AuthPage from "../views/AuthView.vue";
import LoginForm from "@/components/LoginForm.vue";
import SignupForm from "@/components/SignupForm.vue";

import AdminDashboard from "../views/AdminView.vue";
import AgendaManage from "@/components/admin/AgendaManage.vue";
import UserManage from "@/components/admin/UserManage.vue";
import KibanaEmbed from "@/components/admin/KibanaEmbed.vue";

import UserDashboard from "../views/UserView.vue";
import AgendaList from "@/components/user/AgendaList.vue";
import MyVoted from "@/components/user/MyVoted.vue";
import Trending from "@/components/user/Trending.vue";

const routes = [
	{
		path: "/",
		component: AuthPage,
		children: [
			{ path: "", component: LoginForm, meta: { tab: "login" } },
			{ path: "signUp", component: SignupForm, meta: { tab: "signUp" } },
		],
	},
	{
		path: "/admin",
		redirect: "/admin/agendaManage",
		component: AdminDashboard,
		children: [
			{ path: "agendaManage", component: AgendaManage },
			{ path: "userManage", component: UserManage },
			{ path: "kibana", component: KibanaEmbed },
		],
		meta: { requiresAuth: true, role: "admin" },
	},
	{
		path: "/user",
		redirect: "/user/agendaList",
		component: UserDashboard,
		children: [
			{ path: "agendaList", component: AgendaList },
			{ path: "myVoted", component: MyVoted },
			{ path: "trending", component: Trending },
		],
		meta: { requiresAuth: true, role: "user" },
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

router.beforeEach((to, from, next) => {
	const authStore = useAuthStore();
	if (to.meta.requiresAuth && !authStore.user) {
		next("/");
	} else if (to.meta.role && authStore.user?.role !== to.meta.role) {
		next("/");
	} else {
		next();
	}
});

export default router;
