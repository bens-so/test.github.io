const B = 1746144000;
const C = 4;
const L = 3680;
const U = 4194304;

let D;
let E;
let F;

async function G(name) {
  if (typeof window !== "undefined" && typeof fetch === "function") {
    const res = await fetch(new URL(`./${name}`, import.meta.url));
    return new Uint8Array(await res.arrayBuffer());
  }
  const fs = await import("node:fs/promises");
  return new Uint8Array(await fs.readFile(new URL(`./${name}`, import.meta.url)));
}

function H(n) {
  if (!F) throw Error("u");
  let r = (n ^ B ^ 2654435761 ^ F.length) >>> 0;
  for (let i = 0; i < F.length; i++) {
    r = Math.imul(r ^ F[i] ^ ((i + 11) * 197), 2246822519) >>> 0;
  }
  return r >>> 0;
}

async function I() {
  if (F) return F;
  if (!D) {
    D = (async () => {
      const [feed, map] = await Promise.all([G("../feed.xml"), G("../sitemap.xml")]);
      const text = new TextDecoder().decode(feed) + "\n" + new TextDecoder().decode(map);
      const parts = [];
      const re = /<(title|summary|loc|updated)>([^<]+)</g;
      let m;
      while ((m = re.exec(text))) {
        parts.push(m[2].trim());
      }
      F = new TextEncoder().encode(parts.join("|"));
      return F;
    })();
  }
  return D;
}

function M(raw) {
  if (raw.length < U) throw Error("s");
  const out = new Uint8Array(L);
  let p = (B ^ 0x13579bdf) & (U - 1);
  const step = ((((B >>> 1) ^ 0x5bd1e995) >>> 0) | 1) & (U - 1);
  for (let i = 0; i < L; i++) {
    out[i] = raw[p];
    p = (p + step) & (U - 1);
  }
  return out;
}

async function J() {
  if (!E) {
    E = (async () => {
      await I();
      const [w, carrier] = await Promise.all([G("core-b4c.wasm"), G("blob-c7d.bin")]);
      const b = M(carrier);
      const { instance } = await WebAssembly.instantiate(w, { e: { a: H } });
      const x = instance.exports;
      const m = x.memory;
      const p = 4096;
      new Uint8Array(m.buffer).set(b, p);
      return { i: x, m, p, l: b.length };
    })();
  }
  return E;
}

const K = (h) => (h.match(/<title>(.*?)<\/title>/i) || [])[1] || "";
const N = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

async function a(i) {
  const r = await J();
  const p = r.i.m(i, r.p, r.l);
  const n = r.i.n();
  return new TextDecoder().decode(new Uint8Array(r.m.buffer, p, n));
}

async function b() {
  const out = [];
  for (let i = 0; i < C; i++) {
    const h = await a(i);
    const t = N(h);
    const c = t.match(/[^.!?]+[.!?]?/g) || [t];
    out.push({ id: i, title: K(h), summary: c.slice(0, 2).join(" ").trim() });
  }
  return out;
}

export { a, b };
