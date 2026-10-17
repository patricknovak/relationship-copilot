import { describe, expect, it } from "vitest";
import {
  b64urlDecode,
  b64urlEncode,
  classifyPushStatus,
  encryptPayload,
  generateVapidKeys,
  parsePushSubscription,
  sendPush,
  vapidAuthorization,
  vapidFromEnv,
} from "./webPush";

// RFC 8291 §5 / Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

const enc = new TextEncoder();

describe("encryptPayload (RFC 8291)", () => {
  it("reproduces the RFC 8291 example byte for byte", async () => {
    const out = await encryptPayload(
      enc.encode(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.authSecret },
      {
        senderKeys: {
          publicKey: b64urlDecode(RFC.asPublic),
          privateKey: b64urlDecode(RFC.asPrivate),
        },
        salt: b64urlDecode(RFC.salt),
      },
    );
    expect(b64urlEncode(out)).toBe(RFC.body);
  });

  it("uses a fresh salt and sender key every time", async () => {
    const sub = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    const a = await encryptPayload(enc.encode("hi"), sub);
    const b = await encryptPayload(enc.encode("hi"), sub);
    expect(b64urlEncode(a.slice(0, 16))).not.toBe(b64urlEncode(b.slice(0, 16)));
    expect(b64urlEncode(a.slice(21, 86))).not.toBe(b64urlEncode(b.slice(21, 86)));
    // header: salt(16) + rs(4) + idlen(1)=65 + key(65), then ciphertext + 16-byte tag
    expect(a[20]).toBe(65);
    expect(a.length).toBe(86 + 2 + 1 + 16);
  });

  it("can be decrypted by the receiver (round trip with the UA private key)", async () => {
    const sub = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    const body = await encryptPayload(enc.encode("Sam answered — your turn"), sub);
    const salt = body.slice(0, 16);
    const asPublic = body.slice(21, 86);
    const ciphertext = body.slice(86);

    const pub = b64urlDecode(RFC.uaPublic);
    const uaPriv = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: b64urlEncode(pub.slice(1, 33)),
        y: b64urlEncode(pub.slice(33)),
        d: RFC.uaPrivate,
      },
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    const asKey = await crypto.subtle.importKey(
      "raw",
      asPublic,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const ecdh = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPriv, 256),
    );
    const hmac = async (k: Uint8Array<ArrayBuffer>, d: Uint8Array<ArrayBuffer>) =>
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, [
            "sign",
          ]),
          d,
        ),
      );
    const cat = (...p: Uint8Array[]) => {
      const o = new Uint8Array(new ArrayBuffer(p.reduce((n, x) => n + x.length, 0)));
      let i = 0;
      for (const x of p) {
        o.set(x, i);
        i += x.length;
      }
      return o;
    };
    const one = new Uint8Array([1]);
    const prkKey = await hmac(b64urlDecode(RFC.authSecret), ecdh);
    const ikm = (await hmac(prkKey, cat(enc.encode("WebPush: info\0"), pub, asPublic, one))).slice(0, 32);
    const prk = await hmac(salt, ikm);
    const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), one))).slice(0, 16);
    const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), one))).slice(0, 12);
    const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext),
    );
    expect(plain[plain.length - 1]).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe("Sam answered — your turn");
  });

  it("refuses payloads that don't fit one record", async () => {
    await expect(
      encryptPayload(new Uint8Array(5000), { p256dh: RFC.uaPublic, auth: RFC.authSecret }),
    ).rejects.toThrow(/too large/);
  });
});

describe("vapidAuthorization (RFC 8292)", () => {
  it("signs an ES256 JWT for the endpoint's origin that verifies with the public key", async () => {
    const keys = await generateVapidKeys();
    const header = await vapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc",
      { ...keys, subject: "mailto:ops@example.com" },
      1_800_000_000,
    );
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, h, c, s, k] = m!;
    expect(k).toBe(keys.publicKey);
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h)))).toEqual({
      typ: "JWT",
      alg: "ES256",
    });
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_800_000_000 + 12 * 3600,
      sub: "mailto:ops@example.com",
    });
    const pub = await crypto.subtle.importKey(
      "raw",
      b64urlDecode(keys.publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      b64urlDecode(s),
      enc.encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe("parsePushSubscription", () => {
  const keys = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
  it("accepts real push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://web.push.apple.com/QGx1",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ]) {
      expect(parsePushSubscription({ endpoint, keys })?.endpoint).toBe(endpoint);
    }
  });

  it("rejects anything the server shouldn't POST to (SSRF) or malformed keys", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://evil.example.com/push",
      "https://fcm.googleapis.com.evil.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://169.254.169.254/latest",
      "not a url",
    ]) {
      expect(parsePushSubscription({ endpoint, keys })).toBeNull();
    }
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    expect(parsePushSubscription({ endpoint, keys: { p256dh: "AAAA", auth: keys.auth } })).toBeNull();
    expect(parsePushSubscription({ endpoint, keys: { p256dh: keys.p256dh, auth: "AAAA" } })).toBeNull();
    expect(parsePushSubscription({ endpoint })).toBeNull();
    expect(parsePushSubscription(null)).toBeNull();
  });
});

describe("sending", () => {
  it("classifies push service responses", () => {
    expect(classifyPushStatus(201)).toBe("sent");
    expect(classifyPushStatus(410)).toBe("gone");
    expect(classifyPushStatus(404)).toBe("gone");
    expect(classifyPushStatus(429)).toBe("failed");
    expect(classifyPushStatus(500)).toBe("failed");
  });

  it("POSTs an aes128gcm body with VAPID auth and a TTL", async () => {
    const keys = await generateVapidKeys();
    let seen: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: RFC.uaPublic, auth: RFC.authSecret },
      { title: "Sam answered", body: "Your turn", url: "/connections/1" },
      { ...keys, subject: "mailto:ops@example.com" },
      fakeFetch,
    );
    expect(result).toBe("sent");
    const headers = seen!.init.headers as Record<string, string>;
    expect(seen!.url).toBe("https://fcm.googleapis.com/fcm/send/x");
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("86400");
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=/);
  });

  it("is off without both keys", () => {
    expect(vapidFromEnv({})).toBeNull();
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "x" })).toBeNull();
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "x", VAPID_PRIVATE_KEY: "y" })?.subject).toMatch(/^mailto:/);
  });
});
