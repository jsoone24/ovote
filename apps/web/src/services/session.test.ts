import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Smoke test for the session service: persistence in sessionStorage (not
// localStorage — the latter would survive tab close, which we explicitly do
// not want), and clear() removes the row.
//
// `session` initializes once at module-load time, so we resetModules() before
// each test to re-trigger the load() path.
describe('session service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('persists token + voter via set() and clears them via clear()', async () => {
    const { session } = await import('./session.js');
    session.set({
      token: 'tok-123',
      voter: { id: 'v1', email: 'a@b.test', role: 'admin' },
    });

    expect(session.isLoggedIn.value).toBe(true);
    expect(session.token.value).toBe('tok-123');
    expect(session.voter.value?.email).toBe('a@b.test');
    expect(JSON.parse(sessionStorage.getItem('ovote.session') ?? '{}').token).toBe('tok-123');

    session.clear();
    expect(session.isLoggedIn.value).toBe(false);
    expect(session.token.value).toBeNull();
    expect(sessionStorage.getItem('ovote.session')).toBeNull();
  });

  it('hydrates from sessionStorage on import', async () => {
    sessionStorage.setItem(
      'ovote.session',
      JSON.stringify({ token: 'pre', voter: { id: 'v', email: 'e@e', role: 'voter' } }),
    );
    const { session } = await import('./session.js');
    expect(session.isLoggedIn.value).toBe(true);
    expect(session.token.value).toBe('pre');
  });
});
