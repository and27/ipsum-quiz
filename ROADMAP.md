# ROADMAP

## Epic 1 - Fase 0: Fundaciones

Goal: Base de datos, roles, RLS, storage y contratos base listos.

### Tickets

- [ ] V1-F0-001: Esquema inicial de base de datos
- [ ] V1-F0-002: Indices y performance base
- [ ] V1-F0-003: Bootstrap de perfiles y roles
- [ ] V1-F0-004: Politicas RLS completas
- [ ] V1-F0-005: Bucket y politicas de Storage para imagenes
- [ ] V1-F0-006: Helpers de autorizacion en app
- [ ] V1-F0-007: Tipos de dominio y contratos API base

## Epic 2 - Fase 1: Banco de preguntas e imagenes

Goal: CRUD admin de temas/preguntas/opciones + pipeline de imagenes.

### Tickets

- [ ] V1-F1-001: CRUD de temas/categorias (admin)
- [ ] V1-F1-002: CRUD de preguntas (admin)
- [ ] V1-F1-003: CRUD de opciones de pregunta (admin)
- [ ] V1-F1-004: Regla "exactamente una correcta" en banco
- [ ] V1-F1-005: Subida de imagenes con validacion de limites
- [ ] V1-F1-006: Servicio de compresion/procesamiento de imagen
- [ ] V1-F1-007: Integracion de imagenes en UI de admin

## Epic 3 - Fase 2: Simuladores y versionado

Goal: Constructor de simuladores con publish/snapshot/versionado.

### Tickets

- [ ] V1-F2-001: CRUD de simuladores (admin)
- [ ] V1-F2-002: Codigo de acceso por simulador (hash)
- [ ] V1-F2-003: Constructor de version borrador
- [ ] V1-F2-004: Validaciones previas a publicar
- [ ] V1-F2-005: Snapshot inmutable al publicar
- [x] V1-F2-006: Regla de edicion segun intentos
- [x] V1-F2-007: Duplicar version para correcciones (v2)
- [ ] V1-F2-008: Publicacion/activacion y visibilidad estudiante

## Epic 4 - Fase 3: Flujo estudiante e intentos

Goal: Rendir simulador de punta a punta con temporizador y resultados.

### Tickets

- [x] V1-F3-001: Catalogo de simuladores para estudiante
- [x] V1-F3-002: Rate limit de código de acceso
- [x] V1-F3-003: Inicio de intento transaccional
- [x] V1-F3-004: Reanudacion de intento activo
- [x] V1-F3-005: Guardar respuesta unica y limpiar respuesta
- [x] V1-F3-006: UI de examen con navegacion solo adelante
- [x] V1-F3-007: Finalizacion manual y calculo de resultados
- [x] V1-F3-008: Expiracion automatica por tiempo
- [x] V1-F3-009: Historial y detalle de resultados del estudiante
- [ ] V1-F3-010: Bloqueo estricto de mutaciones post cierre

## Epic 5 - Fase 4: Reportes admin

Goal: Reportes con filtros y paginacion (default 20).

### Tickets

- [ ] V1-F4-001: Query service reporte por simulador
- [ ] V1-F4-002: Query service reporte por estudiante
- [ ] V1-F4-003: API admin de reportes
- [ ] V1-F4-004: UI admin de reportes con filtros y paginacion

## Epic 6 - Fase 5: Calidad y release

Goal: Pruebas, hardening y documentacion operativa V1.

### Tickets

- [ ] V1-F5-001: Pruebas de integracion de reglas criticas
- [ ] V1-F5-002: Smoke tests E2E de flujos principales
- [ ] V1-F5-003: Observabilidad y auditoria minima
- [ ] V1-F5-004: Documentacion operativa de despliegue V1

---

Backlog detallado con alcance, dependencias y criterios de aceptacion:
`docs/backlog-tecnico-v1.md`

---

## Plan Acelerado (Nuevos Cambios Solicitados)

Goal: Entregar mejoras de UX, branding y modelo academico sin frenar avance.

### Estrategia de ramas (rapida, pocas ramas)

- `feature/pack-a-branding-ux`: branding + home estudiante por sede
- `feature/pack-b-banco-simulador`: productividad admin banco/simulador
- `feature/pack-c-evaluacion-resultados`: logica de respuestas en blanco + resultados

### Pack A - Branding + Entrada Estudiante

Tickets:

- [ ] V1-PACKA-001: Cambiar `favicon` y `title` global de la app
- [ ] V1-PACKA-002: Home estudiante con 2 cards grandes: `Simuladores Cañar` y `Simuladores Azogues`
- [ ] V1-PACKA-003: Definir modelo de `sede` (simulador pertenece a Cañar/Azogues)
- [ ] V1-PACKA-004: Filtrado de catalogo por sede seleccionada

Notas:

- Recomendado: columna `campus` en `simulators` con `check ('canar','azogues')`.
- Default sugerido para no romper datos actuales: `canar` o `null` + migracion de backfill.

### Pack B - Productividad Admin (Banco + Constructor)

Tickets:

- [ ] V1-PACKB-001: Preguntas nuevas activas por defecto (sin activar manualmente)
- [ ] V1-PACKB-002: Pregunta nueva con 4 opciones predeterminadas
- [ ] V1-PACKB-003: Constructor de simulador: selector de preguntas con `marcar todas`
- [ ] V1-PACKB-004: Constructor de simulador: accion masiva `agregar seleccionadas`

Notas:

- Mantener regla de integridad: al menos 2 opciones activas y 1 correcta.
- UX: vista presentacional + modal de acciones masivas.

### Pack C - Evaluacion y Resultados (Blancos)

Tickets:

- [x] V1-PACKC-001: Permitir respuestas en blanco explicitamente (ya existe UI de limpiar, formalizar logica)
- [x] V1-PACKC-002: Cambiar scoring: `en blanco` no cuenta como `incorrecta`
- [x] V1-PACKC-003: Guardar metrica `blank_count` por intento
- [x] V1-PACKC-004: Mostrar en resultados: correctas, incorrectas, en blanco y porcentaje
- [x] V1-PACKC-005: Mostrar en desglose por tema tambien conteo de `en blanco`

Notas:

- Recomendado: derivar `incorrectas = total - correctas - en_blanco`.
- Evitar romper historicos: migracion no destructiva + fallback si `blank_count` es null.

### Pack D - Admin Analytics (Epic final solicitada)

Tickets:

- [x] V1-PACKD-001: Dashboard de estadisticas admin (cards KPI)
- [x] V1-PACKD-002: KPIs minimos: intentos totales, promedio score, finalizados, expirados, blancos
- [x] V1-PACKD-003: Filtros por rango fecha, sede y simulador
- [x] V1-PACKD-004: Enlace desde navbar admin a estadisticas

### Pack E - Hardening Prueba Masiva (100 estudiantes)

Tickets:

- [ ] V1-PACKE-001: Baseline de rendimiento por endpoint critico (`start`, `answers`, `finish`) con p95/p99
- [ ] V1-PACKE-002: Tablero operativo de prueba (Vercel Functions + Supabase Reports + logs)
- [ ] V1-PACKE-003: Identificar endpoint con `timeout` y aplicar mitigacion (debounce/batch/consulta)
- [ ] V1-PACKE-004: Ajustes de indices/queries en Supabase segun hallazgos de carga
- [ ] V1-PACKE-005: Criterios de aceptacion de capacidad y reporte final de prueba

### Orden recomendado de ejecucion

1. Pack A (modelo sede + entrypoint estudiante)
2. Pack B (productividad admin para cargar contenido rapido)
3. Pack C (reglas de evaluacion/reporting academico)
4. Pack D (estadisticas admin sobre modelo estable)
5. Pack E (hardening de capacidad antes de siguientes cohortes)

### Criterios de cierre por pack

- PR chico/mediano por ticket, pero merge por pack.
- Smoke test manual antes de pasar al siguiente pack.
- No iniciar Pack siguiente sin merge y verificacion del actual.

## Epic 7 - Post-Production Improvements

Goal: Ajustes post salida a produccion para mejorar operacion, velocidad de carga y analitica academica.

### Tickets

- [ ] V1-F6-001: Constructor de simulador con agrupacion automatica por categoria
- [ ] V1-F6-002: Configuracion de orden de categorias en simulador (por bloques)
- [ ] V1-F6-003: Eliminar UX de reordenamiento manual pregunta por pregunta (`subir`, `bajar`, `mover`)
- [ ] V1-F6-004: Aplicar mismo orden agrupado en experiencia de estudiante y snapshot publicado
- [ ] V1-F6-005: Cambiar presentacion de opciones de `1,2,3,4` a `a,b,c,d`
- [ ] V1-F6-006: Exportacion de reportes admin a `CSV`
- [ ] V1-F6-007: Incluir en exportacion: nota, tiempo usado y aciertos por categoria
- [ ] V1-F6-008: Ampliar `admin/stats/students/[id]` con resumen global y lista de intentos
- [ ] V1-F6-009: Agregar en detalle por intento las preguntas con respuesta elegida, correcta y en blanco
- [ ] V1-F6-010: Corregir bug de respuestas en blanco mostradas como incorrectas en detalle admin
- [ ] V1-F6-011: Instrumentacion y diagnostico del bug de blancas en reportes admin
- [x] V1-F6-012: Campo editable `nota de grado` en perfil del estudiante
- [x] V1-F6-013: Persistencia y visualizacion de `nota de grado` en admin
- [x] V1-F6-014: Ordenamiento en `admin/stats/students` por nota ascendente y descendente
- [ ] V1-F6-015: Soporte base para futura proyeccion academica desde `nota de grado`

### Notas

- La agrupacion por categoria reemplaza el orden manual fino de preguntas.
- El admin define el orden de categorias por bloques (ejemplo: `1. Matematicas`, `2. Sociales`).
- Dentro de una misma categoria no se requiere orden estricto entre preguntas.
- El orden agrupado debe reflejarse igual en admin, snapshot publicado y experiencia de estudiante.
- Las opciones deben mostrarse como letras minusculas: `a, b, c, d`.
- La proyeccion academica dependiente de `nota de grado` queda pendiente hasta recibir la formula oficial.

### Orden recomendado de ejecucion

1. Agrupacion automatica por categoria y remocion de reorder manual
2. Cambio visual de opciones a `a,b,c,d`
3. Exportacion `CSV` y ampliacion de reportes admin
4. Correccion e instrumentacion del bug de respuestas en blanco
5. Campo `nota de grado` y preparacion para proyeccion futura
