# Backlog Tecnico V1 por Fases

Fuente: [spec-tecnico-v1.md](C:/Users/SUPERTRONICA/Documents/Projects/ipsum-quiz/docs/spec-tecnico-v1.md)

## Reglas de ejecucion

1. One PR = one issue/ticket.
2. PR pequena, objetivo < 400 net lines.
3. No iniciar siguiente fase hasta smoke test y merge de la fase actual.
4. Checks obligatorios antes de "Ready for review": `pnpm lint`, `pnpm typecheck`, `pnpm build` (si aplica).

## Convenciones de tickets

1. Prefijo: `V1-F<fase>-<numero>`.
2. Cada ticket incluye:
   - Objetivo tecnico
   - Alcance
   - Criterios de aceptacion
   - Dependencias
3. Labels sugeridos:
   - `type:feature`, `type:bug`, `type:tech-debt`, `type:security`
   - `status:ready`, `status:in-progress`, `status:review`, `status:done`
   - `epic:phase-0..5`

---

## Fase 0 - Fundaciones de datos, seguridad y base de app

### V1-F0-001 - Esquema inicial de base de datos

- Objetivo: crear migraciones SQL para tablas base (`profiles`, `topics`, `questions`, `question_options`, `simulators`, `simulator_versions`, `simulator_version_questions`, `simulator_version_question_options`, `attempts`, `attempt_answers`, `attempt_topic_scores`, `access_code_attempts`).
- Alcance: tipos, FKs, checks, `unique`, defaults.
- Criterios de aceptacion:
  - Migracion aplicable en entorno limpio.
  - Todas las tablas y constraints existen.
  - No hay dependencia circular invalida.
- Dependencias: ninguna.

### V1-F0-002 - Indices y performance base

- Objetivo: crear indices definidos en spec para consultas criticas.
- Alcance: indices de `attempts`, `attempt_answers`, `simulator_version_questions`, `access_code_attempts`.
- Criterios de aceptacion:
  - Indices creados por migracion.
  - Consultas de inicio de intento/historial/reportes usan indice.
- Dependencias: `V1-F0-001`.

### V1-F0-003 - Bootstrap de perfiles y roles

- Objetivo: garantizar perfil con rol (`admin` o `student`) para usuarios de Supabase Auth.
- Alcance: trigger/funcion para crear `profiles`, y script SQL para promover primer admin.
- Criterios de aceptacion:
  - Usuario nuevo crea perfil `student` automaticamente.
  - Existe procedimiento documentado para asignar `admin`.
- Dependencias: `V1-F0-001`.

### V1-F0-004 - Politicas RLS completas

- Objetivo: aplicar seguridad por rol y ownership.
- Alcance:
  - Student solo ve/edita sus intentos y respuestas activas.
  - Admin gestiona banco, simuladores, versiones y reportes.
  - Student no ve campos de opcion correcta.
- Criterios de aceptacion:
  - Lecturas/escrituras no autorizadas fallan por RLS.
  - Flujos esperados admin/student pasan con RLS activa.
- Dependencias: `V1-F0-001`, `V1-F0-003`.

### V1-F0-005 - Bucket y politicas de Storage para imagenes

- Objetivo: preparar Storage para originales y derivados.
- Alcance:
  - Buckets `questions-original` (privado) y `questions-public` (publico o firmado).
  - Politicas de subida/lectura segun rol.
- Criterios de aceptacion:
  - Solo admin puede subir originales.
  - Estudiantes solo consumen derivados permitidos.
- Dependencias: `V1-F0-003`, `V1-F0-004`.

### V1-F0-006 - Helpers de autorizacion en app

- Objetivo: unificar guardas de rol/session en capa server.
- Alcance: utilidades en `lib/` para `requireAdmin`, `requireStudent`, `getCurrentProfile`.
- Criterios de aceptacion:
  - Route handlers usan helpers comunes.
  - No hay validaciones de rol duplicadas en cada endpoint.
- Dependencias: `V1-F0-003`, `V1-F0-004`.

### V1-F0-007 - Tipos de dominio y contratos API base

- Objetivo: definir tipos TS de entidades y payloads (request/response).
- Alcance: `lib/domain/` y `lib/usecases/` para contratos V1.
- Criterios de aceptacion:
  - Endpoints y UI usan tipos compartidos.
  - No hay `any` en contratos nuevos.
- Dependencias: `V1-F0-001`.

---

## Fase 1 - Banco de preguntas y pipeline de imagenes

### V1-F1-001 - CRUD de temas/categorias (admin)

- Objetivo: crear UI + API para `topics`.
- Alcance: listar, crear, editar, activar/desactivar.
- Criterios de aceptacion:
  - Solo admin accede.
  - No se permiten nombres duplicados activos.
- Dependencias: `V1-F0-004`, `V1-F0-006`.

### V1-F1-002 - CRUD de preguntas (admin)

- Objetivo: crear gestion de preguntas con enunciado y tema.
- Alcance: alta, edicion, activacion/desactivacion, listado paginado.
- Criterios de aceptacion:
  - Pregunta requiere `topic_id` y `statement`.
  - Preguntas inactivas no aparecen para armado de simulador.
- Dependencias: `V1-F1-001`.

### V1-F1-003 - CRUD de opciones de pregunta (admin)

- Objetivo: gestionar opciones por pregunta con orden.
- Alcance: crear/editar/eliminar opcion, ordenar `position`, activar/desactivar.
- Criterios de aceptacion:
  - Cada pregunta tiene N opciones (N >= 2).
  - Persistencia de orden estable.
- Dependencias: `V1-F1-002`.

### V1-F1-004 - Regla "exactamente una correcta" en banco

- Objetivo: validar y persistir una sola opcion correcta por pregunta.
- Alcance: validacion en API y constraint/trigger de publicacion.
- Criterios de aceptacion:
  - No se puede guardar estado invalido al publicar.
  - Error claro cuando hay 0 o >1 correctas.
- Dependencias: `V1-F1-003`.

### V1-F1-005 - Subida de imagenes con validacion de limites

- Objetivo: endpoint de upload con validacion previa.
- Alcance:
  - MIME permitido: jpeg/png/webp
  - max 8 MB
  - max 4000x4000
- Criterios de aceptacion:
  - Archivos invalidos se rechazan antes de persistir.
  - Mensajes de error claros por causa.
- Dependencias: `V1-F0-005`.

### V1-F1-006 - Servicio de compresion/procesamiento de imagen

- Objetivo: normalizar imagenes para uso en preguntas/opciones.
- Alcance:
  - remover EXIF
  - resize a lado mayor 1600
  - export WebP q80 + fallback JPEG q82
  - guardar metadata (`width`, `height`, `bytes`, `mime_type`)
- Criterios de aceptacion:
  - Imagen final cumple limites.
  - URLs finales se guardan en BD.
- Dependencias: `V1-F1-005`.

### V1-F1-007 - Integracion de imagenes en UI de admin

- Objetivo: habilitar seleccion/preview de imagen en pregunta y opcion.
- Alcance: formularios admin + persistencia de `image_url`.
- Criterios de aceptacion:
  - Preview visible en editor.
  - Reemplazo de imagen no rompe referencia anterior.
- Dependencias: `V1-F1-006`.

---

## Fase 2 - Simuladores, versionado y publicacion

### V1-F2-001 - CRUD de simuladores (admin)

- Objetivo: gestionar entidad `simulators`.
- Alcance: titulo, descripcion, duracion, max intents (default 3), `is_active`, `status`.
- Criterios de aceptacion:
  - Solo admin crea/edita.
  - Validaciones de rangos (duracion > 0, max attempts > 0).
- Dependencias: `V1-F0-004`, `V1-F0-006`.

### V1-F2-002 - Codigo de acceso por simulador (hash)

- Objetivo: almacenar código en hash, nunca en texto plano.
- Alcance: set/update/remove código, verificacion segura.
- Criterios de aceptacion:
  - BD solo guarda hash.
  - Verificacion funciona con código correcto/incorrecto.
- Dependencias: `V1-F2-001`.

### V1-F2-003 - Constructor de version borrador

- Objetivo: crear y editar `simulator_versions` en estado `draft`.
- Alcance: agregar preguntas activas, definir orden exacto 1..N, reordenar.
- Criterios de aceptacion:
  - Orden continuo sin huecos.
  - UI soporta drag/drop o mover posicion.
- Dependencias: `V1-F2-001`, `V1-F1-004`.

### V1-F2-004 - Validaciones previas a publicar

- Objetivo: bloquear publicacion de version invalida.
- Alcance:
  - set no vacio
  - orden completo
  - opciones validas
  - exactamente una correcta por pregunta
- Criterios de aceptacion:
  - Endpoint de publish responde error detallado por regla.
- Dependencias: `V1-F2-003`.

### V1-F2-005 - Snapshot inmutable al publicar

- Objetivo: copiar preguntas y opciones a tablas snapshot al publicar.
- Alcance: `simulator_version_questions` + `simulator_version_question_options`.
- Criterios de aceptacion:
  - Intentos usan solo snapshot, no banco vivo.
  - Cambios posteriores en banco no alteran snapshot.
- Dependencias: `V1-F2-004`.

### V1-F2-006 - Regla de edicion segun intentos

- Objetivo: permitir editar snapshot solo si `has_attempts = false`.
- Alcance: guardas backend + UX de bloqueo.
- Criterios de aceptacion:
  - Con intentos, edicion bloqueada.
  - Sin intentos, edicion permitida.
- Dependencias: `V1-F2-005`.

### V1-F2-007 - Duplicar version para correcciones (v2)

- Objetivo: flujo "duplicar -> corregir -> publicar".
- Alcance: clon de version publicada a nuevo `draft` con referencias base.
- Criterios de aceptacion:
  - Version duplicada conserva orden y contenido.
  - Publicar v2 no altera resultados historicos v1.
- Dependencias: `V1-F2-006`.

### V1-F2-008 - Publicacion/activacion y visibilidad estudiante

- Objetivo: exponer solo simuladores `published` + `is_active = true`.
- Alcance: consultas, filtros y guardas de acceso.
- Criterios de aceptacion:
  - Simulador inactivo o draft no visible para student.
- Dependencias: `V1-F2-005`.

---

## Fase 3 - Flujo de estudiante e intentos

### V1-F3-001 - Catalogo de simuladores para estudiante

- Objetivo: pantalla de listado de simuladores disponibles.
- Alcance: lista paginada/busqueda simple con estado visible.
- Criterios de aceptacion:
  - Solo muestra published+active.
  - No expone datos internos de admin.
- Dependencias: `V1-F2-008`.

### V1-F3-002 - Rate limit de código de acceso

- Objetivo: implementar limite de 5 fallos en 5 minutos por `student+ip+simulator`.
- Alcance: tabla `access_code_attempts`, verificacion, error temporal.
- Criterios de aceptacion:
  - Bloquea en el intento 6 dentro de ventana.
  - Tras ventana, permite volver a intentar.
- Dependencias: `V1-F0-001`, `V1-F2-002`.

### V1-F3-003 - Inicio de intento transaccional

- Objetivo: crear intento con reglas de negocio completas.
- Alcance:
  - valida código
  - consume intento al iniciar
  - valida max attempts
  - impide >1 intento activo por student/simulator
  - crea `attempt` y seed de `attempt_answers`
- Criterios de aceptacion:
  - No hay condiciones de carrera (race condition) en doble click.
  - `expires_at` correcto segun duracion.
- Dependencias: `V1-F3-002`.

### V1-F3-004 - Reanudacion de intento activo

- Objetivo: retomar estado exacto al recargar/cerrar.
- Alcance: endpoint y carga de intento activo con respuestas guardadas.
- Criterios de aceptacion:
  - Reingreso carga misma pregunta/estado.
  - Si expiro, no reanuda y muestra resultado final.
- Dependencias: `V1-F3-003`.

### V1-F3-005 - Guardar respuesta unica y limpiar respuesta

- Objetivo: persistir seleccion unica por pregunta y permitir vaciar.
- Alcance: `PATCH answers`, upsert, validacion de pertenencia opcion/pregunta.
- Criterios de aceptacion:
  - Solo una opcion seleccionada por pregunta.
  - `selected_option_id = null` limpia respuesta.
- Dependencias: `V1-F3-003`.

### V1-F3-006 - UI de examen con navegacion solo adelante

- Objetivo: implementar experiencia de rendicion.
- Alcance:
  - pregunta actual + total (ej 10/60)
  - tema actual
  - temporizador visible
  - boton siguiente
  - sin boton retroceder
  - tablero de progreso informativo (sin navegacion retroactiva)
- Criterios de aceptacion:
  - No existe flujo para volver a pregunta anterior.
  - Tablero refleja respondidas/pendientes en tiempo real.
- Dependencias: `V1-F3-004`, `V1-F3-005`.

### V1-F3-007 - Finalizacion manual y calculo de resultados

- Objetivo: cerrar intento por accion de usuario y calcular score.
- Alcance: puntaje total + puntaje por tema, persistir en tablas de resultado.
- Criterios de aceptacion:
  - 1 punto por correcta.
  - en blanco cuenta incorrecta.
  - no existe estado aprobado/reprobado.
- Dependencias: `V1-F3-005`.

### V1-F3-008 - Expiracion automatica por tiempo

- Objetivo: cerrar intentos al llegar a cero incluso si usuario no finaliza.
- Alcance:
  - verificacion al leer intento
  - tarea periodica server-side (cron/job/worker) para expirar activos vencidos
- Criterios de aceptacion:
  - Intentos vencidos terminan en `expired`.
  - Resultados se calculan con respuestas al momento de expirar.
- Dependencias: `V1-F3-007`.

### V1-F3-009 - Historial y detalle de resultados del estudiante

- Objetivo: mostrar intentos pasados propios con desglose.
- Alcance: listado paginado + vista de resultado por intento.
- Criterios de aceptacion:
  - Student solo ve sus intentos.
  - Resumen incluye total y por tema.
- Dependencias: `V1-F3-007`.

### V1-F3-010 - Bloqueo estricto de mutaciones post cierre

- Objetivo: impedir cambios en intentos `finished` o `expired`.
- Alcance: guardas backend + pruebas.
- Criterios de aceptacion:
  - Cualquier update de respuestas post-cierre retorna error.
- Dependencias: `V1-F3-007`.

---

## Fase 4 - Reportes administrativos

### V1-F4-001 - Query service reporte por simulador

- Objetivo: construir consulta agregada por simulador.
- Alcance:
  - intentos realizados
  - puntaje promedio
  - desglose por tema
  - filtros: simulador, estudiante, date_from/date_to
  - paginacion default 20
- Criterios de aceptacion:
  - Respuesta paginada consistente.
  - Filtros combinables sin romper conteo total.
- Dependencias: `V1-F3-007`, `V1-F0-002`.

### V1-F4-002 - Query service reporte por estudiante

- Objetivo: construir consulta de historial de rendimiento por estudiante.
- Alcance:
  - intentos por estudiante
  - puntaje total por intento
  - desglose por tema
  - filtros y paginacion default 20
- Criterios de aceptacion:
  - Soporta orden por fecha desc.
  - Respeta rango de fechas.
- Dependencias: `V1-F3-009`, `V1-F0-002`.

### V1-F4-003 - API admin de reportes

- Objetivo: exponer endpoints seguros para reportes.
- Alcance: `/api/admin/reports/simulators`, `/api/admin/reports/students`.
- Criterios de aceptacion:
  - Solo admin accede.
  - Parametros invalidos retornan 400.
- Dependencias: `V1-F4-001`, `V1-F4-002`, `V1-F0-006`.

### V1-F4-004 - UI admin de reportes con filtros y paginacion

- Objetivo: pantalla de reportes operable por negocio.
- Alcance:
  - filtro por simulador
  - filtro por estudiante
  - filtro por rango de fechas
  - paginacion 20
- Criterios de aceptacion:
  - Cambio de filtros refresca resultados correctamente.
  - Paginacion mantiene filtros activos.
- Dependencias: `V1-F4-003`.

---

## Fase 5 - Calidad, pruebas y hardening de release

### V1-F5-001 - Pruebas de integracion de reglas criticas

- Objetivo: cubrir invariantes de negocio en backend.
- Alcance:
  - 1 intento activo maximo
  - consumo de intento al iniciar
  - bloqueo post-cierre
  - snapshot inmutable
  - rate limit de código
- Criterios de aceptacion:
  - Suite automatizada ejecutable en CI local.
- Dependencias: `V1-F3-010`, `V1-F2-007`.

### V1-F5-002 - Smoke tests E2E de flujos principales

- Objetivo: validar punta a punta admin y student.
- Alcance:
  - admin crea banco + simulador + publica
  - student inicia, responde, finaliza, ve resultados
  - reportes admin visibles
- Criterios de aceptacion:
  - Flujo completo estable en entorno dev/staging.
- Dependencias: `V1-F4-004`.

### V1-F5-003 - Observabilidad y auditoria minima

- Objetivo: trazabilidad de eventos criticos.
- Alcance: logs estructurados para publish, start, finish, expire, errores de rate limit.
- Criterios de aceptacion:
  - Logs permiten reconstruir un incidente funcional.
- Dependencias: `V1-F3-008`, `V1-F4-003`.

### V1-F5-004 - Documentacion operativa de despliegue V1

- Objetivo: dejar runbook de operacion.
- Alcance:
  - env vars
  - bootstrap admin
  - politica de imagenes
  - ejecucion de expiracion automatica (cron/job)
  - checklist de release
- Criterios de aceptacion:
  - Un desarrollador nuevo puede levantar y operar V1 solo con docs.
- Dependencias: `V1-F5-002`.

---

## Matriz de cobertura (spec -> tickets)

1. Roles y auth -> `V1-F0-003`, `V1-F0-004`, `V1-F0-006`.
2. Simulador visible solo published+active -> `V1-F2-008`, `V1-F3-001`.
3. Codigo de acceso + rate limit -> `V1-F2-002`, `V1-F3-002`.
4. Intentos maximos + consumo al iniciar -> `V1-F3-003`.
5. Un intento activo por student/simulator -> `V1-F3-003`, `V1-F5-001`.
6. Reanudar intento activo -> `V1-F3-004`.
7. Temporizador y cierre automatico -> `V1-F3-006`, `V1-F3-008`.
8. Opcion unica + vaciar respuesta -> `V1-F3-005`.
9. Navegacion solo adelante + tablero informativo -> `V1-F3-006`.
10. Puntaje total + por tema, sin aprobado/reprobado -> `V1-F3-007`, `V1-F3-009`.
11. Bloqueo de edicion tras cierre -> `V1-F3-010`.
12. Banco de preguntas y validacion de opcion correcta -> `V1-F1-002`, `V1-F1-003`, `V1-F1-004`.
13. Imagenes en Storage + compresion y limites -> `V1-F0-005`, `V1-F1-005`, `V1-F1-006`, `V1-F1-007`.
14. Versionado con snapshot y duplicado -> `V1-F2-005`, `V1-F2-006`, `V1-F2-007`.
15. Reportes con filtros y paginacion 20 -> `V1-F4-001`, `V1-F4-002`, `V1-F4-003`, `V1-F4-004`.
16. Endurecimiento y release -> `V1-F5-001`, `V1-F5-002`, `V1-F5-003`, `V1-F5-004`.
