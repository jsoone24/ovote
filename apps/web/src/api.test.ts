import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Smoke test for the api client: verifies the bearer header is attached when
// a session is set, and that logout() POSTs /auth/logout. These two paths
// regressed in past reviews; cheap to keep them green.
describe('api client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches Authorization: Bearer header when a session is present', async () => {
    const { session } = await import('./services/session.js');
    const { api } = await import('./api.js');

    session.set({ token: 'abc', voter: { id: 'v', email: 'e@e', role: 'voter' } });

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ voters: [] }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await api.listVoters();

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer abc');
  });

  it('logout() POSTs /auth/logout', async () => {
    const { api } = await import('./api.js');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'logged-out' }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await api.logout();

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url.endsWith('/auth/logout')).toBe(true);
    expect(init.method).toBe('POST');
  });
});
