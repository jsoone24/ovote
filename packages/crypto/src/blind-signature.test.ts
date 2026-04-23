import { describe, expect, it } from 'vitest';
import {
  blindMessage,
  blindSign,
  exportPrivateKey,
  exportPublicKey,
  finalize,
  generateKeyPair,
  importPrivateKey,
  importPublicKey,
  prepareMessage,
  verify,
} from './blind-signature.js';

describe('RSA blind signature (RFC 9474, BSSA)', () => {
  it('issue-and-verify round-trip: registrar cannot link signature to voter', async () => {
    const { publicKey, privateKey } = await generateKeyPair(2048);

    // voter prepares a credential nonce (32 random bytes)
    const nonce = new Uint8Array(32);
    globalThis.crypto.getRandomValues(nonce);
    const msg = prepareMessage(nonce);

    // voter blinds
    const { blindedMsg, inv } = await blindMessage(publicKey, msg);

    // registrar signs the BLIND message — never sees `nonce`
    const blindSig = await blindSign(privateKey, blindedMsg);

    // voter unblinds
    const sig = await finalize(publicKey, msg, blindSig, inv);

    // anyone can verify the signature on the cleartext nonce
    expect(await verify(publicKey, sig, msg)).toBe(true);
  }, 20_000);

  it('verify fails for signature over different message', async () => {
    const { publicKey, privateKey } = await generateKeyPair(2048);
    const nonce = new Uint8Array(32);
    globalThis.crypto.getRandomValues(nonce);
    const msg = prepareMessage(nonce);
    const { blindedMsg, inv } = await blindMessage(publicKey, msg);
    const blindSig = await blindSign(privateKey, blindedMsg);
    const sig = await finalize(publicKey, msg, blindSig, inv);

    const other = prepareMessage(new Uint8Array(32));
    expect(await verify(publicKey, sig, other)).toBe(false);
  }, 20_000);

  it('public key export/import round-trip', async () => {
    const { publicKey } = await generateKeyPair(2048);
    const b64 = await exportPublicKey(publicKey);
    const imported = await importPublicKey(b64);
    expect(imported).toBeDefined();
  }, 20_000);

  it('private key export/import round-trip', async () => {
    const { privateKey } = await generateKeyPair(2048);
    const b64 = await exportPrivateKey(privateKey);
    const imported = await importPrivateKey(b64);
    expect(imported).toBeDefined();
  }, 20_000);
});
