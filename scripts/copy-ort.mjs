// Copies the ONNX WebAssembly runtime into public/ort so the site serves it itself (the on-device
// speech worker loads it from /ort/ instead of a CDN). Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("onnxruntime-web"));
const out = path.join(process.cwd(), "public", "ort");
mkdirSync(out, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) copyFileSync(path.join(dist, f), path.join(out, f));
console.log("Copied the ONNX runtime to public/ort");
