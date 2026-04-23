import { ref, computed } from 'vue';

interface SessionData {
  token: string;
  voter: { id: string; email: string; role: string };
}

const STORAGE_KEY = 'ovote.session';

function load(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

const state = ref<SessionData | null>(load());

export const session = {
  token: computed(() => state.value?.token ?? null),
  voter: computed(() => state.value?.voter ?? null),
  isLoggedIn: computed(() => state.value !== null),
  set(data: SessionData): void {
    state.value = data;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  clear(): void {
    state.value = null;
    sessionStorage.removeItem(STORAGE_KEY);
  },
};
