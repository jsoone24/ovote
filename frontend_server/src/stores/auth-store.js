import { defineStore } from "pinia";
import axios from "axios";

export const useAuthStore = defineStore("auth", {
	state: () => ({
		user: null,
		token: localStorage.getItem("token") || "",
		csrfToken: "",
	}),
	getters: {
		getDisplayName: (state) => {
			return state.user.name.length > 7
				? `${state.user.name.substring(0, 7)}...`
				: state.user.name;
		},
		getOrganization: (state) => state.user.organization,
		getVotedAgendas: (state) => state.user.votedAgendas,
		getId: (state) => state.user._id,
	},
	actions: {
		async getCsrfToken() {
			if (!this.csrfToken) {
				const response = await axios.get("/api/csrf-token", {
					withCredentials: true,
				});
				this.csrfToken = response.data.csrfToken;
				axios.defaults.headers.common["X-CSRF-Token"] = this.csrfToken;
			}
		},
		async login(credentials) {
			await this.getCsrfToken();

			const response = await axios.post("/api/users/login", credentials, {
				headers: { "X-CSRF-Token": this.csrfToken },
				withCredentials: true,
			});

			this.token = response.data.token;
			localStorage.setItem("token", this.token);

			const payload = JSON.parse(atob(this.token.split(".")[1]));
			this.user = payload.user;

			axios.defaults.headers.common[
				"Authorization"
			] = `Bearer ${this.token}`;
		},
		logout() {
			this.user = null;
			this.token = "";
			this.csrfToken = "";
			localStorage.removeItem("token");
			delete axios.defaults.headers.common["Authorization"];
			delete axios.defaults.headers.common["X-CSRF-Token"];
		},
		tryAutoLogin() {
			const token = localStorage.getItem("token");
			if (!token) return;

			const payload = JSON.parse(atob(token.split(".")[1]));
			if (payload.exp * 1000 < Date.now()) {
				this.logout();
				return;
			}

			this.token = token;
			this.user = payload.user;
			axios.defaults.headers.common[
				"Authorization"
			] = `Bearer ${this.token}`;

			this.getCsrfToken()
				.then()
				.catch((error) => {
					console.error("Failed to get CSRF token:", error);
				});
		},
		async signUp(userData) {
			try {
            const response = await axios.post('/api/users/signup', userData);
			console.log(response);
			} catch (error) {
				console.error("Failed to signup user:", error);
			}
        },
	},
});