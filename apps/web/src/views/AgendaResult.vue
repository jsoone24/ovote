<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Agenda, TallyProof } from '@ovote/shared';
import { api } from '../api.js';

const props = defineProps<{ id: string }>();

const agenda = ref<Agenda | null>(null);
const result = ref<TallyProof | null>(null);
const error = ref('');

onMounted(async () => {
  try {
    agenda.value = await api.getAgenda(props.id);
    result.value = await api.getResult(props.id);
  } catch (e) {
    error.value = (e as Error).message;
  }
});

function labelFor(optionId: string): string {
  return agenda.value?.options.find((o) => o.id === optionId)?.label ?? optionId;
}
</script>

<template>
  <div class="panel">
    <h1>{{ agenda?.title ?? 'agenda' }}</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="result">
      <p class="muted">published {{ new Date(result.publishedAt).toLocaleString() }}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 1rem">
        <thead>
          <tr>
            <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">option</th>
            <th style="text-align: right; padding: 0.5rem 0; border-bottom: 1px solid var(--border)">count</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in result.results" :key="r.optionId">
            <td style="padding: 0.5rem 0">{{ labelFor(r.optionId) }}</td>
            <td style="text-align: right; padding: 0.5rem 0"><strong>{{ r.count }}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
