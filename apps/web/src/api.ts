import type { Agenda, Ballot, TallyProof, TrusteeDecryptionShare } from '@ovote/shared';
import { session } from './services/session.js';

const BASE = (import.meta.env.VITE_OVOTE_API ?? '/api') as string;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const token = session.token.value;
  if (token && !headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    session.clear();
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body as T;
}

export const api = {
  requestOtp: (email: string) =>
    request<{ status: string }>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email: string, code: string) =>
    request<{ sessionToken: string; voter: { id: string; email: string; role: string } }>(
      '/auth/otp/verify',
      { method: 'POST', body: JSON.stringify({ email, code }) },
    ),
  logout: () => request<{ status: string }>('/auth/logout', { method: 'POST' }),
  listAgendas: () => request<{ agendas: Agenda[] }>('/agendas'),
  getAgenda: (id: string) => request<Agenda>(`/agendas/${id}`),
  blindSign: (agendaId: string, blindedMessage: string) =>
    request<{ blindSignature: string }>('/credentials/blind-sign', {
      method: 'POST',
      body: JSON.stringify({ agendaId, blindedMessage }),
    }),
  castBallot: (ballot: Ballot) =>
    request<{ id: string; status: string }>('/ballots', {
      method: 'POST',
      body: JSON.stringify(ballot),
    }),
  listBallots: (agendaId: string) =>
    request<{ ballots: Ballot[] }>(`/ballots/${agendaId}`),
  listDecryptionShares: (agendaId: string) =>
    request<{ shares: TrusteeDecryptionShare[] }>(`/decryption-shares/${agendaId}`),
  getAggregate: (agendaId: string) =>
    request<{ agendaId: string; options: { optionId: string; c1: string; c2: string }[] }>(
      `/agendas/${agendaId}/aggregate`,
    ),
  submitDecryptionShare: (share: TrusteeDecryptionShare) =>
    request<{ status: string }>('/decryption-shares', {
      method: 'POST',
      body: JSON.stringify({ share }),
    }),
  publishResult: (agendaId: string) =>
    request<TallyProof>('/results/publish', {
      method: 'POST',
      body: JSON.stringify({ agendaId }),
    }),
  getResult: (agendaId: string) => request<TallyProof>(`/results/${agendaId}`),

  // Admin APIs — every call here must be made by a session with role=admin.
  createAgenda: (body: {
    title: string;
    description: string;
    openAt: string;
    closeAt: string;
    options: { id: string; label: string }[];
    key: { groupPk: string; threshold: number; n: number; trustees: { index: number; pk: string }[] };
  }) => request<Agenda>('/agendas', { method: 'POST', body: JSON.stringify(body) }),
  openAgenda: (agendaId: string) =>
    request<{ status: string }>(`/agendas/${agendaId}/open`, { method: 'POST' }),
  closeAgenda: (agendaId: string) =>
    request<{ status: string }>(`/agendas/${agendaId}/close`, { method: 'POST' }),
  setEligibility: (agendaId: string, emails: string[]) =>
    request<{ added: number }>(`/agendas/${agendaId}/eligibility`, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),
  listEligibility: (agendaId: string) =>
    request<{ voters: { voterId: string; email: string }[] }>(
      `/admin/agendas/${agendaId}/eligibility`,
    ),
  listVoters: () =>
    request<{ voters: { id: string; email: string; role: 'voter' | 'admin' | 'trustee' }[] }>(
      '/admin/voters',
    ),
  setVoterRole: (email: string, role: 'voter' | 'admin' | 'trustee') =>
    request<{ voter: { id: string; email: string; role: string } }>('/admin/voters/role', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
};
