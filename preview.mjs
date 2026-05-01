const ROUTES = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  ops: 0,
  labs: 1,
  field: 2,
  format: 3,
  "/ops": 0,
  "/labs": 1,
  "/field": 2,
  "/format": 3,
};

async function runtime() {
  return import(new URL("./assets/app-6f3a9.js", import.meta.url));
}

export async function materialize(target = 0) {
  const mod = await runtime();
  const id = typeof target === "number" ? target : (ROUTES[target] ?? 0);
  return mod.a(id);
}

export async function summarizeAll() {
  const mod = await runtime();
  return mod.b();
}

export default { materialize, summarizeAll };
