import axios from "axios";
import { defineStore } from "pinia";

export const useUserStore = defineStore("user", {
	state: () => ({
		users: [],
	}),
	getters: {
		allUsers: (state) => state.users,
	},
	actions: {
		async fetchUsers() {
			const response = await axios.get("/api/users");
			this.users = response.data;
		},
	},
});
