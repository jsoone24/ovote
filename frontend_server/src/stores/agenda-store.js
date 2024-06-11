import axios from "axios";
import { defineStore } from "pinia";

export const useAgendaStore = defineStore("agenda", {
	state: () => ({
		agendas: [],
	}),
	getters: {
		allAgendas: (state) => state.agendas,
	},
	actions: {
		async createAgenda(agendaData) {
			const response = await axios.post("/api/agendas", agendaData);
			this.agendas.push(response.data);
		},
		async fetchAgendas() {
			const response = await axios.get("/api/agendas");
			this.agendas = response.data;
		},
		async updateAgenda(agendaData) {
			const agendaId = agendaData._id;
			const response = await axios.put(
				`/api/agendas/${agendaId}`,
				agendaData
			);
			const index = this.agendas.findIndex((a) => a._id === agendaId);
			if (index !== -1) {
				this.agendas.splice(index, 1, response.data);
			}
		},
		async deleteAgenda(agendaId) {
			await axios.delete(`/api/agendas/${agendaId}`);
			const index = this.agendas.findIndex((a) => a._id === agendaId);
			if (index !== -1) {
				this.agendas.splice(index, 1);
			}
		},
	},
});
