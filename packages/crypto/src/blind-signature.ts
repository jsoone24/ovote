import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { toB64Url, fromB64Url } from '@ovote/shared';

const suite = RSABSSA.SHA384.PSS.Randomized();

export interface BlindSignatureKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface BlindedMessage {
  blindedMsg: Uint8Array;
  inv: Uint8Array;
}

export async function generateKeyPair(modulusLength: 2048 | 3072 | 4096 = 3072): Promise<BlindSignatureKeyPair> {
  const kp = await RSABSSA.SHA384.generateKey({ modulusLength, publicExponent: new Uint8Array([1, 0, 1]) });
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

export async function exportPublicKey(pk: CryptoKey): Promise<string> {
  const spki = await globalThis.crypto.subtle.exportKey('spki', pk);
  return toB64Url(new Uint8Array(spki));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const spki = fromB64Url(b64);
  return globalThis.crypto.subtle.importKey(
    'spki',
    spki.buffer.slice(spki.byteOffset, spki.byteOffset + spki.byteLength) as ArrayBuffer,
    { name: 'RSA-PSS', hash: 'SHA-384' },
    true,
    ['verify'],
  );
}

export async function exportPrivateKey(sk: CryptoKey): Promise<string> {
  const pkcs8 = await globalThis.crypto.subtle.exportKey('pkcs8', sk);
  return toB64Url(new Uint8Array(pkcs8));
}

export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  const pkcs8 = fromB64Url(b64);
  return globalThis.crypto.subtle.importKey(
    'pkcs8',
    pkcs8.buffer.slice(pkcs8.byteOffset, pkcs8.byteOffset + pkcs8.byteLength) as ArrayBuffer,
    { name: 'RSA-PSS', hash: 'SHA-384' },
    true,
    ['sign'],
  );
}

export function prepareMessage(msg: Uint8Array): Uint8Array {
  return suite.prepare(msg);
}

export async function blindMessage(publicKey: CryptoKey, preparedMsg: Uint8Array): Promise<BlindedMessage> {
  return suite.blind(publicKey, preparedMsg);
}

export async function blindSign(privateKey: CryptoKey, blindedMsg: Uint8Array): Promise<Uint8Array> {
  return suite.blindSign(privateKey, blindedMsg);
}

export async function finalize(
  publicKey: CryptoKey,
  preparedMsg: Uint8Array,
  blindSig: Uint8Array,
  inv: Uint8Array,
): Promise<Uint8Array> {
  return suite.finalize(publicKey, preparedMsg, blindSig, inv);
}

export async function verify(publicKey: CryptoKey, signature: Uint8Array, preparedMsg: Uint8Array): Promise<boolean> {
  return suite.verify(publicKey, signature, preparedMsg);
}
