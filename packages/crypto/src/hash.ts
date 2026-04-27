import { sha256 } from '@noble/hashes/sha256';
import { canonicalJSON } from '@ovote/shared';
import { type Scalar, pointToBytes, type Point } from './ristretto.js';
import { ristretto255 } from '@noble/curves/ed25519';

const Fn = ristretto255.Point.Fn;

// hashBytes returns sha256(part_0 || part_1 || …) with a single allocation.
export function hashBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    joined.set(p, off);
    off += p.length;
  }
  return sha256(joined);
}

// hashToScalar deterministically derives a ristretto255 scalar from
// (domain, parts...). Mirrored byte-for-byte by chaincode/ovote/crypto/hash.go
// — the Fiat-Shamir transcripts on both sides MUST agree, otherwise an
// auditor's TS-side recomputation would reject what the chaincode accepted.
//
// Construction:
//   1. d = sha256("ovote/v1/" + domain || part_0 || part_1 || …)
//   2. e = sha256(d)
//   3. wide = d || e                                  (64 bytes)
//   4. result = bigint(wide, big-endian) mod L         (L = ristretto255 order)
//
// The two-block sha256 is the standard "double-SHA wide reduction" used by
// libsodium / IETF hash-to-curve drafts; it gives a uniform distribution mod
// L without needing dedicated hash-to-field gear.
export function hashToScalar(domain: string, parts: Uint8Array[]): Scalar {
  const domainBytes = new TextEncoder().encode(`ovote/v1/${domain}`);
  const first = hashBytes([domainBytes, ...parts]);
  const second = sha256(first);
  const wide = new Uint8Array(64);
  wide.set(first, 0);
  wide.set(second, 32);
  let acc = 0n;
  for (const b of wide) acc = (acc << 8n) | BigInt(b);
  return Fn.create(acc);
}

export function transcriptScalar(domain: string, transcript: unknown): Scalar {
  const s = canonicalJSON(transcript);
  const bytes = new TextEncoder().encode(s);
  return hashToScalar(domain, [bytes]);
}

export function pointsToTranscriptBytes(points: Point[]): Uint8Array {
  const out = new Uint8Array(points.length * 32);
  for (let i = 0; i < points.length; i++) out.set(pointToBytes(points[i]!), i * 32);
  return out;
}
