/**
 * Load test del FLUJO REAL de inicio de simulador (pasa por Vercel/Next.js).
 *
 * A diferencia de loadtest-start.mjs (que pega directo al RPC de la DB), este
 * script reproduce lo que vive un estudiante "despues de ingresar el codigo":
 * pega al route handler real
 *
 *     POST {APP_URL}/api/student/simulators/<id>/attempts/start
 *
 * que ejecuta requireStudent() -> verifySimulatorAccessCodeForStudent()
 * (incluye scryptSync, CPU-bound) -> RPC start_or_resume_attempt. Por eso este
 * es el que sirve para reproducir los 500s que el otro script NO puede ver.
 *
 * Como el route lee la sesion de COOKIES (@supabase/ssr), no de un Bearer
 * token, el script:
 *   1. Crea N estudiantes de prueba (service role) y los marca role=student.
 *   2. Inicia sesion (password grant) -> obtiene la sesion completa.
 *   3. Construye la cookie sb-<ref>-auth-token igual que @supabase/ssr.
 *   4. Hace UN preflight para confirmar que la auth funciona.
 *   5. Dispara N inicios EN PARALELO contra el endpoint real.
 *   6. Reporta status, latencia y errores agrupados.
 *
 * Uso (multiplataforma, Mac/Linux/Windows):
 *   node scripts/loadtest-start-endpoint.mjs <simulatorId> <accessCode> [concurrency=20] --app-url=<url>
 *
 *   ej:
 *   node scripts/loadtest-start-endpoint.mjs 14a7... 12345 30 --app-url=https://simulador.ipsumsolutio.com
 *
 *   --app-url = dominio de PRODUCCION donde ocurren los 500s (el que usan los
 *               estudiantes). Tambien se puede pasar via env APP_URL. Por
 *               defecto http://localhost:3000, pero localhost NO reproduce la
 *               presion de CPU del serverless: apunta al dominio real.
 *
 * Requiere Node 18+ (usa fetch global).
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (anon)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   (opcional) SUPABASE_PROJECT_REF        si usas dominio custom de Supabase
 *
 * OJO: crea intentos REALES en la DB que apunte .env.local. Usa un simulador
 *      de PRUEBA con max_attempts alto. Al final imprime el SQL para limpiar.
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

// Separa flags (--app-url=...) de los argumentos posicionales para que el
// mismo comando funcione igual en bash, zsh, PowerShell y cmd.
const flags = {};
const positional = [];
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) flags[m[1]] = m[2];
  else positional.push(arg);
}

const APP_URL = (flags["app-url"] ?? process.env.APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const simulatorId = positional[0];
const accessCode = positional[1];
const concurrency = Number(positional[2] ?? 20);
const PASSWORD = "LoadTest123!";
const RUN_ID = Date.now().toString(36);

if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error("Faltan vars: NEXT_PUBLIC_SUPABASE_URL / *_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!simulatorId || !accessCode) {
  console.error(
    "Uso: node scripts/loadtest-start-endpoint.mjs <simulatorId> <accessCode> [concurrency=20] --app-url=<url>",
  );
  process.exit(1);
}

// Project ref: por defecto la primera etiqueta del host de Supabase
// (https://<ref>.supabase.co). Override con SUPABASE_PROJECT_REF si usas
// dominio custom.
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
const MAX_CHUNK_SIZE = 3180; // igual que @supabase/ssr

const adminHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

function base64UrlEncode(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Reproduce el storage de @supabase/ssr: serializa la sesion, la codifica como
 * "base64-<base64url>" y la parte en chunks .0 .1 ... si pasa MAX_CHUNK_SIZE.
 * Devuelve el header Cookie listo para enviar.
 */
function buildSessionCookieHeader(session) {
  const value = `base64-${base64UrlEncode(JSON.stringify(session))}`;

  if (value.length <= MAX_CHUNK_SIZE) {
    return `${COOKIE_NAME}=${value}`;
  }

  const parts = [];
  for (let i = 0; i * MAX_CHUNK_SIZE < value.length; i++) {
    const chunk = value.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
    parts.push(`${COOKIE_NAME}.${i}=${chunk}`);
  }
  return parts.join("; ");
}

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
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ role: "student" }),
  });
  return { id, email };
}

/** Password grant -> sesion completa (access_token, refresh_token, user, ...). */
async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(body)}`);
  return body; // la respuesta ES el objeto de sesion que @supabase/ssr persiste
}

async function callStart(user) {
  const t0 = performance.now();
  try {
    const res = await fetch(
      `${APP_URL}/api/student/simulators/${simulatorId}/attempts/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie,
          // IP distinta por estudiante para que el rate-limit por IP no interfiera
          "x-forwarded-for": `10.${(user.idx >> 8) & 255}.${user.idx & 255}.1`,
        },
        body: JSON.stringify({ accessCode }),
      },
    );
    const text = await res.text();
    return { ms: Math.round(performance.now() - t0), status: res.status, body: text };
  } catch (err) {
    return { ms: Math.round(performance.now() - t0), status: 0, body: String(err) };
  }
}

console.log(`\n== Target: ${APP_URL} (ref ${PROJECT_REF}) ==`);
console.log(`== Provisionando ${concurrency} estudiantes de prueba (run ${RUN_ID}) ==`);
const users = [];
for (let i = 0; i < concurrency; i++) {
  const u = await createTestUser(i);
  const session = await signIn(u.email);
  u.cookie = buildSessionCookieHeader(session);
  u.idx = i;
  users.push(u);
  process.stdout.write(".");
}
console.log(`\nListos ${users.length} estudiantes.\n`);

// Preflight: una sola llamada para confirmar que la cookie/auth funciona antes
// de gastar el burst. Si esto da 401 con mensaje de auth, la cookie esta mal.
console.log(`== Preflight (1 llamada) ==`);
const pre = await callStart(users[0]);
console.log(`status ${pre.status} en ${pre.ms}ms`);
console.log(`body: ${pre.body.slice(0, 300)}`);
if (pre.status === 401 && /sesion|unauthenticated|auth|inicia/i.test(pre.body)) {
  console.error(
    "\n!! El preflight parece fallar por AUTENTICACION, no por el flujo del simulador.",
  );
  console.error(
    "   La cookie de sesion no fue aceptada. Revisa SUPABASE_PROJECT_REF / version de @supabase/ssr.",
  );
  console.error("   Abortando antes del burst.\n");
  printCleanup();
  process.exit(1);
}
console.log("(auth OK, el endpoint respondio al flujo del simulador)\n");

console.log(`== Disparando ${concurrency} inicios EN PARALELO contra el endpoint real ==`);
const tStart = performance.now();
const results = await Promise.all(users.map((u) => callStart(u)));
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
  console.log(`\nERRORES (status: cuerpo):`);
  for (const [k, n] of Object.entries(errors)) console.log(`  x${n}  ${k}`);
  console.log(
    `\nSi ves 500s aqui pero loadtest-start.mjs (RPC directo) NO da errores,`,
  );
  console.log(`el cuello de botella esta en la capa serverless (auth/scrypt/Vercel).`);
} else {
  console.log(`\nSin errores en el flujo real.`);
}

printCleanup();

function printCleanup() {
  const ids = users.map((u) => `'${u.id}'`).join(", ");
  if (!ids) return;
  console.log(`\n== LIMPIEZA (corre esto en el SQL Editor de Supabase) ==`);
  console.log(`delete from public.access_code_attempts where student_id in (${ids});`);
  console.log(`delete from public.attempt_answers where attempt_id in (select id from public.attempts where student_id in (${ids}));`);
  console.log(`delete from public.attempts where student_id in (${ids});`);
  console.log(`-- y para borrar los usuarios de prueba: Auth > Users, filtra por "loadtest+${RUN_ID}"`);
}
