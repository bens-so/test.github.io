const PERMS = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [1, 0, 3, 2],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
  [2, 3, 1, 0],
  [3, 1, 0, 2],
  [3, 2, 1, 0]
];

const SALT = [83, 157, 199, 33];

export const meta = {
  site: "Bens Notes",
  build: 1746057600,
  codec: "archive-bin/v1",
  preview_api: "decoder.mjs:summarize(route)",
  routes: [
    "/",
    "/about",
    "/posts/opsec-notes",
    "/posts/labs",
    "/posts/field-notes",
    "/posts/archive-format",
    "/feed.xml",
    "/sitemap.xml",
    "/verify"
  ],
  posts: [
    { route: "/posts/opsec-notes", title: "Opsec Notes", digest: "7e3a9d", words: 157 },
    { route: "/posts/labs", title: "Labs", digest: "f14d20", words: 157 },
    { route: "/posts/field-notes", title: "Field Notes", digest: "b53fd0", words: 134 },
    { route: "/posts/archive-format", title: "Archive Format", digest: "ee912a", words: 151 }
  ]
};

let archivePromise;

function mix(x) {
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x >>>= 0;
  x ^= x << 5;
  x >>>= 0;
  return x >>> 0;
}

async function readBytes() {
  if (typeof window !== "undefined" && typeof fetch === "function") {
    const res = await fetch(new URL("./archive.bin", import.meta.url));
    return new Uint8Array(await res.arrayBuffer());
  }

  const fs = await import("node:fs/promises");
  return new Uint8Array(await fs.readFile(new URL("./archive.bin", import.meta.url)));
}

function unpack(spec) {
  const out = new Uint8Array(spec.size);
  let state = spec.seed >>> 0;
  let write = 0;

  for (let i = 0; i < spec.words.length; i += 1) {
    state = mix((state + 0x6d2b79f5 + write + spec.size) >>> 0);
    const perm = PERMS[state & 7];
    const word = spec.words[i] >>> 0;
    const base = write;

    for (let lane = 0; lane < 4 && write < spec.size; lane += 1) {
      const raw = (word >>> (perm[lane] * 8)) & 255;
      const salt = (((state >>> ((lane * 9) & 24)) & 255) ^ SALT[lane] ^ ((base * 13 + lane * 17) & 255)) & 255;
      out[write] = (raw ^ salt) & 255;
      write += 1;
    }

    state = mix((state ^ word ^ 0x9e3779b9) >>> 0);
  }

  return out;
}

function parseArchive(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  function u16() {
    const value = dv.getUint16(offset, true);
    offset += 2;
    return value;
  }

  function u32() {
    const value = dv.getUint32(offset, true);
    offset += 4;
    return value;
  }

  const magic = new TextDecoder().decode(bytes.slice(0, 5));
  offset = 5;
  if (magic !== "BNAR1") {
    throw new Error("Invalid archive");
  }

  const count = u16();
  const table = {};
  const text = new TextDecoder();

  for (let i = 0; i < count; i += 1) {
    const routeLen = u16();
    const size = u32();
    const seed = u32();
    const width = u32();
    const route = text.decode(bytes.slice(offset, offset + routeLen));
    offset += routeLen;
    const words = [];
    for (let j = 0; j < width; j += 1) {
      words.push(u32());
    }
    table[route] = { size, seed, words };
  }

  return table;
}

export async function loadArchive() {
  if (!archivePromise) {
    archivePromise = readBytes().then(parseArchive);
  }
  return archivePromise;
}

export async function materialize(route) {
  const table = await loadArchive();
  const spec = table[route];
  if (!spec) {
    return "";
  }
  return new TextDecoder().decode(unpack(spec));
}

export function textOnly(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function summarize(route, sentences = 3) {
  const text = textOnly(await materialize(route));
  const chunks = text.match(/[^.!?]+[.!?]?/g) || [text];
  return {
    route,
    summary: chunks.slice(0, sentences).join(" ").trim(),
    characters: text.length
  };
}

export async function summarizeAll() {
  const out = [];
  for (const post of meta.posts) {
    out.push({
      route: post.route,
      title: post.title,
      summary: (await summarize(post.route, 2)).summary
    });
  }
  return out;
}
