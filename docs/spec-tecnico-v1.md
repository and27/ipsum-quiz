# Especificacion Tecnica V1 - Plataforma de Simuladores

## 1. Objetivo

Definir el diseno tecnico implementable para la V1 de la plataforma de simuladores academicos en este repositorio (Next.js + Supabase), cerrando reglas de negocio, modelo de datos, seguridad, APIs y criterios operativos.

## 2. Alcance V1 (cerrado)

1. Roles: `admin` y `student`.
2. Autenticacion: email + password (Supabase Auth).
3. Simuladores visibles para estudiante: solo `published` y `is_active = true`.
4. Acceso por código de simulador obligatorio cuando exista.
5. Rate limit para validacion de código: 5 intentos fallidos por 5 minutos por `user_id + ip + simulator_id`.
6. Intentos maximos por simulador: configurable por admin, default 3.
7. Regla de consumo de intentos: intento iniciado = intento consumido.
8. Unico intento activo por `student + simulator_id`.
9. Reanudacion: si hay intento activo y no expirado, se retoma estado exacto al recargar/cerrar.
10. Temporizador duro: al expirar, el intento se finaliza automaticamente y se califica con respuestas guardadas.
11. Puntaje: 1 punto por pregunta, respuesta en blanco cuenta como incorrecta.
12. Resultado: puntaje total y desglose por tema (sin aprobado/reprobado).
13. Navegacion en V1: solo avance (sin retroceso); tablero solo informativo.
14. Reportes admin: filtros (simulador, estudiante, rango de fechas), paginacion default 20.
15. Versionado de simulador:
    - Publicar crea snapshot inmutable.
    - Snapshot editable solo si tiene 0 intentos.
    - Si ya tiene intentos: duplicar, corregir, publicar nueva version.
16. Imagenes en Supabase Storage con validacion, compresion y normalizacion.

## 3. Arquitectura

1. Frontend: Next.js App Router (`app/`) con Server Components y Client Components.
2. Backend web: Route Handlers + Server Actions en Next.js.
3. Autenticacion y sesion: `@supabase/ssr` con cookies.
4. Base de datos y RLS: Supabase Postgres.
5. Almacenamiento de imagenes: Supabase Storage.
6. Procesamiento de imagenes: servicio backend (job/endpoint) que normaliza y comprime antes de publicar URL final.

## 4. Modelo de datos propuesto

### 4.1 Tablas de identidad

1. `profiles`
   - `id uuid pk` (fk a `auth.users.id`)
   - `role text check (role in ('admin','student'))`
   - `full_name text null`
   - `created_at timestamptz default now()`

### 4.2 Banco de preguntas

1. `topics`
   - `id uuid pk`
   - `name text unique`
   - `is_active boolean default true`
2. `questions`
   - `id uuid pk`
   - `topic_id uuid fk topics(id)`
   - `statement text not null`
   - `image_url text null`
   - `is_active boolean default true`
   - `created_by uuid fk profiles(id)`
   - `updated_at timestamptz`
3. `question_options`
   - `id uuid pk`
   - `question_id uuid fk questions(id) on delete cascade`
   - `position int not null`
   - `text text not null`
   - `image_url text null`
   - `is_correct boolean not null default false`
   - `is_active boolean default true`
4. Restriccion critica:
   - Un indice/constraint para garantizar exactamente 1 opcion correcta por pregunta en estado valido de publicacion (se valida con trigger al publicar).

### 4.3 Simuladores y versionado

1. `simulators`
   - `id uuid pk`
   - `title text not null`
   - `description text null`
   - `access_code_hash text null`
   - `max_attempts int not null default 3`
   - `duration_minutes int not null`
   - `is_active boolean default false`
   - `status text check (status in ('draft','published'))`
   - `published_version_id uuid null`
   - `created_by uuid fk profiles(id)`
2. `simulator_versions`
   - `id uuid pk`
   - `simulator_id uuid fk simulators(id) on delete cascade`
   - `version_number int not null`
   - `status text check (status in ('draft','published','archived'))`
   - `created_from_version_id uuid null`
   - `published_at timestamptz null`
   - `has_attempts boolean default false`
   - `unique(simulator_id, version_number)`
3. `simulator_version_questions` (snapshot)
   - `id uuid pk`
   - `simulator_version_id uuid fk simulator_versions(id) on delete cascade`
   - `position int not null`
   - `topic_id uuid fk topics(id)`
   - `statement text not null`
   - `image_url text null`
   - `source_question_id uuid null`
   - `unique(simulator_version_id, position)`
4. `simulator_version_question_options` (snapshot)
   - `id uuid pk`
   - `simulator_version_question_id uuid fk simulator_version_questions(id) on delete cascade`
   - `position int not null`
   - `text text not null`
   - `image_url text null`
   - `is_correct boolean not null`
   - `unique(simulator_version_question_id, position)`

### 4.4 Intentos y respuestas

1. `attempts`
   - `id uuid pk`
   - `simulator_id uuid fk simulators(id)`
   - `simulator_version_id uuid fk simulator_versions(id)`
   - `student_id uuid fk profiles(id)`
   - `status text check (status in ('active','finished','expired'))`
   - `started_at timestamptz not null`
   - `expires_at timestamptz not null`
   - `finished_at timestamptz null`
   - `score_total int null`
   - `questions_total int not null`
   - `created_at timestamptz default now()`
2. `attempt_answers`
   - `id uuid pk`
   - `attempt_id uuid fk attempts(id) on delete cascade`
   - `simulator_version_question_id uuid fk simulator_version_questions(id)`
   - `selected_option_id uuid null fk simulator_version_question_options(id)`
   - `is_correct boolean null`
   - `answered_at timestamptz null`
   - `unique(attempt_id, simulator_version_question_id)`
3. `attempt_topic_scores`
   - `id uuid pk`
   - `attempt_id uuid fk attempts(id) on delete cascade`
   - `topic_id uuid fk topics(id)`
   - `correct_count int not null`
   - `total_count int not null`
   - `unique(attempt_id, topic_id)`

### 4.5 Seguridad de código y rate limit

1. `access_code_attempts`
   - `id bigserial pk`
   - `simulator_id uuid fk simulators(id)`
   - `student_id uuid fk profiles(id)`
   - `ip inet not null`
   - `success boolean not null`
   - `created_at timestamptz default now()`
2. Indices:
   - `(simulator_id, student_id, ip, created_at desc)`
3. Regla:
   - Si existen 5 fallidos en ventana de 5 minutos, bloquear validacion temporal.

## 5. Reglas de negocio

1. Estudiante no puede ver opciones correctas en payloads ni UI.
2. Solo admin puede crear/editar/publicar simuladores, preguntas y opciones.
3. Un simulador `published` sin `is_active` no aparece al estudiante.
4. No se puede iniciar intento si:
   - simulador no publicado o inactivo
   - código invalido
   - excede intentos maximos
   - ya existe intento activo de ese simulador
5. Si `now() >= expires_at` y el intento sigue `active`, se marca `expired` y se calcula resultado.
6. Intento finalizado o expirado no permite cambios de respuestas.
7. Publicacion valida solo si:
   - set de preguntas no vacio
   - orden continuo sin huecos
   - cada pregunta tiene opciones validas
   - exactamente 1 opcion correcta por pregunta
8. Snapshot publicado:
   - editable solo cuando `has_attempts = false`
   - con intentos, solo via duplicacion de version

## 6. Flujos backend clave

### 6.1 Iniciar intento

1. Validar rol `student`.
2. Cargar simulador publicado y activo.
3. Validar rate limit de código.
4. Validar código (comparando hash).
5. Validar intentos consumidos `< max_attempts`.
6. Validar ausencia de intento activo.
7. Crear `attempt` en transaccion con `expires_at = now() + duration`.
8. Seed de `attempt_answers` con una fila por pregunta del snapshot.

### 6.2 Guardar respuesta

1. Validar intento activo y no expirado.
2. Validar que opcion pertenece a la pregunta del snapshot.
3. Upsert de respuesta (1 sola opcion posible por pregunta).
4. Permitir limpiar respuesta (`selected_option_id = null`).

### 6.3 Finalizar intento

1. Cerrar intento manual o por expiracion.
2. Calcular `is_correct` por respuesta.
3. Calcular `score_total`.
4. Calcular `attempt_topic_scores`.
5. Persistir y bloquear futuras modificaciones.

### 6.4 Reanudar intento

1. Buscar intento `active` por `student + simulator`.
2. Si no expiro, devolver estado completo para continuar.
3. Si expiro, ejecutar finalizacion por expiracion y devolver resultado.

## 7. APIs recomendadas (Route Handlers)

1. `POST /api/student/simulators/{id}/attempts/start`
2. `GET /api/student/attempts/{attemptId}`
3. `PATCH /api/student/attempts/{attemptId}/answers`
4. `POST /api/student/attempts/{attemptId}/finish`
5. `GET /api/student/attempts/history?page=1&pageSize=20`
6. `GET /api/student/attempts/{attemptId}/result`
7. `POST /api/admin/simulators`
8. `PATCH /api/admin/simulators/{id}`
9. `POST /api/admin/simulators/{id}/versions/{versionId}/publish`
10. `POST /api/admin/simulators/{id}/versions/{versionId}/duplicate`
11. `GET /api/admin/reports/simulators?...`
12. `GET /api/admin/reports/students?...`

## 8. Seguridad y RLS

1. `profiles`: usuario solo puede leer su propio perfil; admin puede leer todos.
2. `questions`, `question_options`, `simulators`, `versions`: escritura solo admin.
3. Lectura estudiante:
   - solo simuladores publicados y activos
   - nunca columnas de respuesta correcta en vistas estudiante
4. `attempts` y `attempt_answers`:
   - estudiante solo accede a sus registros
   - admin puede leer todo para reportes
5. Storage:
   - bucket privado para originales (`questions-original`)
   - bucket publico o firmado para derivados (`questions-public`)
   - subida solo admin autenticado

## 9. Especificacion de imagenes (buenas practicas V1)

1. Formatos de entrada permitidos: `image/jpeg`, `image/png`, `image/webp`.
2. Tamano maximo de archivo: 8 MB.
3. Resolucion maxima de entrada: 4000 x 4000 px.
4. Procesamiento obligatorio:
   - remover metadata EXIF
   - redimensionar a maximo 1600 px por lado mayor
   - exportar principal a WebP calidad 80
   - fallback JPEG calidad 82 si aplica compatibilidad
5. Rechazar archivos fuera de limites antes de persistir.
6. Guardar `width`, `height`, `bytes`, `mime_type` y URL final en metadata.

## 10. Reportes V1

1. Filtros soportados:
   - `simulator_id`
   - `student_id`
   - `date_from`, `date_to` (sobre `finished_at`)
2. Paginacion:
   - `page` (default 1)
   - `page_size` (default 20, max 100)
3. Vista por simulador:
   - intentos totales
   - promedio de puntaje
   - desglose por tema
4. Vista por estudiante:
   - historial de intentos
   - puntaje total por intento
   - puntaje por tema

## 11. Indices minimos recomendados

1. `attempts(student_id, simulator_id, created_at desc)`
2. `attempts(simulator_id, status, created_at desc)`
3. `attempts(status, expires_at)`
4. `attempt_answers(attempt_id)`
5. `simulator_version_questions(simulator_version_id, position)`
6. `access_code_attempts(simulator_id, student_id, ip, created_at desc)`

## 12. Criterios tecnicos de aceptacion

1. Ningun estudiante puede iniciar intento fuera de reglas de estado/código/intentos.
2. Nunca hay mas de un intento activo por estudiante y simulador.
3. Cierre por tiempo funciona incluso con navegador cerrado.
4. Resultados total y por tema coinciden con snapshot del simulador rendido.
5. Editar banco de preguntas no altera intentos historicos.
6. Reportes admin responden con filtros y paginacion default 20.
7. Carga de imagenes fuera de limites es rechazada con mensaje claro.

## 13. Fuera de alcance V1

1. Exportacion CSV/PDF.
2. Estado aprobado/reprobado por umbral.
3. Banco de preguntas con multimedia avanzada (audio/video).
4. Modo offline.
