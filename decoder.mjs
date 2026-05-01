export const meta = {
  site: "Bridge Preview",
  build: 1746144000,
  codec: "bridge-pack/v1",
  preview_api: "decoder.mjs:summarize(route)",
  routes: [
    "/",
    "/about",
    "/posts/opsec-notes",
    "/posts/labs",
    "/posts/field-notes",
    "/posts/archive-format"
  ],
  posts: [
    { route: "/posts/opsec-notes", title: "Opsec Notes", digest: "7e3a9d", words: 157 },
    { route: "/posts/labs", title: "Labs", digest: "f14d20", words: 157 },
    { route: "/posts/field-notes", title: "Field Notes", digest: "b53fd0", words: 134 },
    { route: "/posts/archive-format", title: "Archive Format", digest: "ee912a", words: 151 }
  ]
};

const INIT_REQUEST = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    clientInfo: { name: "bridge-preview", version: "1.0.0" },
    capabilities: {}
  }
};

let bridgeReply;
let bridgeReplyPromise;
let runtimePromise;

function frame(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const out = Buffer.alloc(4 + body.length);
  out.writeUInt32LE(body.length, 0);
  body.copy(out, 4);
  return out;
}

function hashReply(token, route, bytes) {
  let acc = (token ^ meta.build ^ (route.length << 11) ^ 0x9e3779b9) >>> 0;

  for (let i = 0; i < route.length; i += 1) {
    acc = Math.imul(acc ^ route.charCodeAt(i) ^ ((i + 23) * 257), 2246822519) >>> 0;
  }

  for (let i = 0; i < bytes.length; i += 1) {
    acc = Math.imul(acc ^ bytes[i] ^ ((i + 1) * 131), 2654435761) >>> 0;
  }

  return acc >>> 0;
}

async function readBytes(name) {
  if (typeof window !== "undefined" && typeof fetch === "function") {
    const res = await fetch(new URL(`./${name}`, import.meta.url));
    return new Uint8Array(await res.arrayBuffer());
  }

  const fs = await import("node:fs/promises");
  return new Uint8Array(await fs.readFile(new URL(`./${name}`, import.meta.url)));
}

function extractFrame(chunks) {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
  if (total < 4) {
    return null;
  }

  const merged = Buffer.concat(chunks);
  const size = merged.readUInt32LE(0);
  if (merged.length < 4 + size) {
    return null;
  }

  return new Uint8Array(merged.subarray(4, 4 + size));
}

async function primeBridge() {
  if (bridgeReply) {
    return bridgeReply;
  }

  if (!bridgeReplyPromise) {
    bridgeReplyPromise = (async () => {
      const pipe = import.meta.__codexNativePipe;
      if (!pipe?.createConnection) {
        throw new Error("native pipe bridge unavailable");
      }

      const socket = await pipe.createConnection("/tmp/codex-browser-use-iab.sock");
      const chunks = [];

      bridgeReply = await new Promise((resolve, reject) => {
        let settled = false;

        const finish = (err, value) => {
          if (settled) {
            return;
          }
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(value);
        };

        socket.on("data", (buf) => {
          chunks.push(Buffer.from(buf));
          const body = extractFrame(chunks);
          if (body) {
            socket.end?.();
            finish(null, body);
          }
        });

        socket.on("close", () => {
          const body = extractFrame(chunks);
          if (body) {
            finish(null, body);
            return;
          }
          finish(new Error("bridge closed before a frame was received"));
        });

        socket.on("error", (err) => finish(err));
        socket.write(frame(INIT_REQUEST));
      });

      return bridgeReply;
    })();
  }

  return bridgeReplyPromise;
}

function fold(token) {
  if (!bridgeReply) {
    throw new Error("bridge has not been primed");
  }

  const routeId = token & 255;
  const route = meta.routes[routeId] || "";
  return hashReply(token, route, bridgeReply);
}

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await primeBridge();

      const [wasmBytes, archiveBytes] = await Promise.all([
        readBytes("decoder.wasm"),
        readBytes("archive.bin")
      ]);

      const { instance } = await WebAssembly.instantiate(wasmBytes, { env: { fold } });
      const memory = instance.exports.memory;
      const archivePtr = 2048;
      new Uint8Array(memory.buffer).set(archiveBytes, archivePtr);

      return {
        archiveLen: archiveBytes.length,
        archivePtr,
        instance,
        memory
      };
    })();
  }

  return runtimePromise;
}

export async function materialize(route) {
  const routeId = meta.routes.indexOf(route);
  if (routeId === -1) {
    return "";
  }

  const vm = await runtime();
  const ptr = vm.instance.exports.materialize(routeId, vm.archivePtr, vm.archiveLen);
  const len = vm.instance.exports.result_len();
  return new TextDecoder().decode(new Uint8Array(vm.memory.buffer, ptr, len));
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
