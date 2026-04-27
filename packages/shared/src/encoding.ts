// Wire-format encoding helpers: base64url for raw bytes and a canonical-JSON
// serializer for transcripts. Both are intentionally pure and dependency-free
// — the chaincode (Go) reproduces the same byte outputs.

const B64URL_ALPHABET = /^[A-Za-z0-9_-]*$/;

/**
 * Encode `bytes` as URL-safe base64 with no padding. Compatible with Node
 * Buffer's `'base64url'` mode and with WebCrypto's typical output. Used for
 * every point/scalar/proof value that crosses the wire.
 */
export function toB64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = globalThis.btoa
    ? globalThis.btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Decode a URL-safe base64 string (with or without padding) into bytes.
 * Throws on illegal characters so the caller can reject malformed input
 * with a 400 instead of an opaque crypto-layer panic.
 */
export function fromB64Url(s: string): Uint8Array {
  if (!B64URL_ALPHABET.test(s)) {
    throw new Error('invalid base64url: illegal character');
  }
  const padLen = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const binary = globalThis.atob
    ? globalThis.atob(b64)
    : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * RFC 8785-flavored canonical JSON: object keys sorted lexicographically,
 * no insignificant whitespace, `undefined` / `NaN` / `Infinity` / `bigint`
 * rejected. Stable across runs and across languages — the chaincode and
 * any third-party verifier produce byte-identical output for the same value,
 * which is what makes it safe to feed into a Fiat-Shamir transcript.
 */
export function canonicalJSON(value: unknown): string {
  return serialize(value);
}

function serialize(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) throw new Error('canonicalJSON: undefined is not permitted');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('canonicalJSON: non-finite number');
    return JSON.stringify(v);
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'bigint') throw new Error('canonicalJSON: bigint is not permitted');
  if (Array.isArray(v)) return '[' + v.map(serialize).join(',') + ']';
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return '{' + entries.map(([k, val]) => JSON.stringify(k) + ':' + serialize(val)).join(',') + '}';
  }
  throw new Error(`canonicalJSON: unsupported value of type ${typeof v}`);
}
