/**
 * Load test para start_or_resume_attempt.
 *
 * Dispara N inicios EN PARALELO contra el RPC de Supabase (salta Vercel) para
 * reproducir el burst de una clase entera sin pedirle a nadie que se conecte.
 *
 * Que hace:
 *   1. Crea N estudiantes de prueba (usa el service role) y los marca role=student.
 *   2. Inicia sesion de cada uno -> obtiene su access_token.
 *   3. Llama start_or_resume_attempt en PARALELO con los N tokens.
 *   4. Reporta status, tiempo y error de cada peticion.
 *
 * Uso:
 *   node scripts/loadtest-start.mjs <simulatorId> [concurrency=20]
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (anon)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * OJO: esto crea intentos REALES en la DB del proyecto que apunte .env.local.
 *      Usa un simulador de PRUEBA con max_attempts alto. Al final imprime el
 *      SQL para limpiar.
 */

import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // si no hay .env.local, asumimos que las vars ya estan en el entorno
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const simulatorId = process.argv[2];
const concurrency = Number(process.argv[3] ?? 20);
const PASSWORD = "LoadTest123!";
const RUN_ID = Date.now().toString(36);

if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error("Faltan vars: NEXT_PUBLIC_SUPABASE_URL / *_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!simulatorId) {
  console.error("Uso: node scripts/loadtest-start.mjs <simulatorId> [concurrency=20]");
  process.exit(1);
}

const adminHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function createTestUser(i) {
  const email = `loadtest+${RUN_ID}-${i}@example.com`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`crear usuario ${i}: ${res.status} ${JSON.stringify(body)}`);
  const id = body.id;
  // asegurar role=student (por si el trigger pone otro default)
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ role: "student" }),
  });
  return { id, email };
}

async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

async function callStart(token) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_or_resume_attempt`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_simulator_id: simulatorId }),
    });
    const text = await res.text();
    return { ms: Math.round(performance.now() - t0), status: res.status, body: text };
  } catch (err) {
    return { ms: Math.round(performance.now() - t0), status: 0, body: String(err) };
  }
}

console.log(`\n== Provisionando ${concurrency} estudiantes de prueba (run ${RUN_ID}) ==`);
const users = [];
for (let i = 0; i < concurrency; i++) {
  const u = await createTestUser(i);
  u.token = await signIn(u.email);
  users.push(u);
  process.stdout.write(".");
}
console.log(`\nListos ${users.length} estudiantes.\n`);

console.log(`== Disparando ${concurrency} inicios EN PARALELO ==`);
const tStart = performance.now();
const results = await Promise.all(users.map((u) => callStart(u.token)));
const totalMs = Math.round(performance.now() - tStart);

let ok = 0;
const errors = {};
const times = [];
for (const r of results) {
  times.push(r.ms);
  if (r.status >= 200 && r.status < 300) {
    ok++;
  } else {
    const key = `${r.status}: ${r.body.slice(0, 200)}`;
    errors[key] = (errors[key] ?? 0) + 1;
  }
}
times.sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))];

console.log(`\n== RESULTADOS ==`);
console.log(`Exitosos:  ${ok}/${concurrency}`);
console.log(`Pared total: ${totalMs} ms`);
console.log(`Latencia ms -> min ${times[0]} | p50 ${pct(50)} | p95 ${pct(95)} | max ${times[times.length - 1]}`);
if (Object.keys(errors).length) {
  console.log(`\nERRORES:`);
  for (const [k, n] of Object.entries(errors)) console.log(`  x${n}  ${k}`);
} else {
  console.log(`\nSin errores. La DB aguanto el burst -> el problema esta en la capa serverless (Vercel).`);
}

const ids = users.map((u) => `'${u.id}'`).join(", ");
console.log(`\n== LIMPIEZA (corre esto en el SQL Editor de Supabase) ==`);
console.log(`delete from public.attempt_answers where attempt_id in (select id from public.attempts where student_id in (${ids}));`);
console.log(`delete from public.attempts where student_id in (${ids});`);
console.log(`-- y para borrar los usuarios de prueba: Auth > Users, filtra por "loadtest+${RUN_ID}"`);
