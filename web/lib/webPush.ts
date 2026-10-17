// Web Push with no third-party account: VAPID (RFC 8292) and aes128gcm
// payload encryption (RFC 8291), implemented on Web Crypto only so the same
// code runs on Node and on Cloudflare Workers. Framework-free and unit-tested
// against the RFC 8291 test vector.
//
// Privacy: the payload is end-to-end encrypted to the browser, so the push
// service (Google, Mozilla, Apple, Microsoft) sees only ciphertext. We still
// send nothing a lock screen shouldn't show: a first name and a generic line,
// never answer text.

const enc = new TextEncoder();

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const clean = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// Web Crypto wants a plain ArrayBuffer-backed view.
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Subscriptions: only real push services, so the server never POSTs to an
// address a user made up (SSRF).
// ---------------------------------------------------------------------------

const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Validate a browser PushSubscription before storing it. */
export function parsePushSubscription(raw: unknown): PushSubscriptionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof r.endpoint !== "string" || r.endpoint.length > 1024) return null;
  let url: URL;
  try {
    url = new URL(r.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return null;
  if (!PUSH_HOSTS.some((re) => re.test(url.hostname))) return null;
  const p256dh = r.keys?.p256dh;
  const auth = r.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  try {
    const pk = b64urlDecode(p256dh);
    const as = b64urlDecode(auth);
    if (pk.length !== 65 || pk[0] !== 0x04 || as.length !== 16) return null;
  } catch {
    return null;
  }
  return { endpoint: url.toString(), p256dh, auth };
}

// ---------------------------------------------------------------------------
// HKDF (single-block expand; every output here is <= 32 bytes)
// ---------------------------------------------------------------------------

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    buf(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, buf(data)));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const t = await hmac(prk, concat(info, new Uint8Array([1])));
  return t.slice(0, length);
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

function jwkFromKeys(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error("expected an uncompressed P-256 public key");
  }
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(publicKey.slice(1, 33)),
    y: b64urlEncode(publicKey.slice(33, 65)),
    ext: true,
  };
  if (privateKey) jwk.d = b64urlEncode(privateKey);
  return jwk;
}

/** Generate a VAPID key pair as base64url strings (public: 65-byte raw). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64urlEncode(pub), privateKey: jwk.d! };
}

// ---------------------------------------------------------------------------
// RFC 8291 aes128gcm
// ---------------------------------------------------------------------------

export interface EncryptOptions {
  /** Test hook: the sender's ephemeral key pair (raw public, raw private). */
  senderKeys?: { publicKey: Uint8Array; privateKey: Uint8Array };
  /** Test hook: the 16-byte salt. */
  salt?: Uint8Array;
}

const RECORD_SIZE = 4096;

/** Encrypt one push message body for a subscription (single record). */
export async function encryptPayload(
  plaintext: Uint8Array,
  sub: { p256dh: string; auth: string },
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  if (plaintext.length > RECORD_SIZE - 17 - 86) throw new Error("push payload too large");

  let asPublic: Uint8Array;
  let asPrivateKey: CryptoKey;
  if (options.senderKeys) {
    asPublic = options.senderKeys.publicKey;
    asPrivateKey = await crypto.subtle.importKey(
      "jwk",
      jwkFromKeys(options.senderKeys.publicKey, options.senderKeys.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    asPrivateKey = pair.privateKey;
  }

  const uaKey = await crypto.subtle.importKey(
    "raw",
    buf(uaPublic),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256),
  );

  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = await hkdfExpand(prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const key = await crypto.subtle.importKey("raw", buf(cek), { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  const record = concat(plaintext, new Uint8Array([0x02])); // last-record delimiter
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, key, buf(record)),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

// ---------------------------------------------------------------------------
// RFC 8292 VAPID
// ---------------------------------------------------------------------------

export interface VapidConfig {
  publicKey: string; // base64url raw P-256 public key
  privateKey: string; // base64url 32-byte private scalar
  subject: string; // mailto: or https: contact
}

/** The Authorization header value for one push endpoint. */
export async function vapidAuthorization(
  endpoint: string,
  vapid: VapidConfig,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud, exp: nowSeconds + 12 * 3600, sub: vapid.subject })),
  );
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwkFromKeys(b64urlDecode(vapid.publicKey), b64urlDecode(vapid.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // Web Crypto returns r||s (IEEE P1363), which is exactly JWS ES256.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)),
  );
  return `vapid t=${signingInput}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface PushMessage {
  title: string;
  body: string;
  url: string; // same-origin path the notification opens
  tag?: string; // collapses repeats for the same thing
}

export type PushResult = "sent" | "gone" | "failed";

/**
 * Classify a push service response: 404/410 mean the subscription is dead.
 * 401/403 stay "failed", not "gone": they usually mean our VAPID config is
 * wrong, and deleting on them would wipe every device at once. After a key
 * rotation, PushToggle replaces the browser's stale subscription instead.
 */
export function classifyPushStatus(status: number): PushResult {
  if (status >= 200 && status < 300) return "sent";
  if (status === 404 || status === 410) return "gone";
  return "failed";
}

export async function sendPush(
  sub: PushSubscriptionInput,
  message: PushMessage,
  vapid: VapidConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub);
  const res = await fetchImpl(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(24 * 3600),
      Urgency: "normal",
    },
    body: buf(body),
  });
  return classifyPushStatus(res.status);
}

/** VAPID config from env, or null when push isn't set up (feature off). */
export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = env.VAPID_SUBJECT?.trim() || "mailto:privacy@relationshipcopilot.com";
  return { publicKey, privateKey, subject };
}
