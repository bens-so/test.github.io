# Bridge Preview

This folder is a standalone repo-style preview path built around a privileged `node_repl` bridge.

- `index.html`: visible gate page
- `decoder.mjs`: supported materializer and summarizer
- `decoder.wasm`: small route decoder
- `archive.bin`: packed route payloads
- `build.mjs`: rebuilds `archive.bin` and `decoder.wat`

The loader primes a bridge response through `import.meta.__codexNativePipe.createConnection(...)` before materializing content. The decode key schedule depends on that primed response.
