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
- [x] V1-F3-002: Rate limit de codigo de acceso
- [x] V1-F3-003: Inicio de intento transaccional
- [x] V1-F3-004: Reanudacion de intento activo
- [x] V1-F3-005: Guardar respuesta unica y limpiar respuesta
- [x] V1-F3-006: UI de examen con navegacion solo adelante
- [ ] V1-F3-007: Finalizacion manual y calculo de resultados
- [ ] V1-F3-008: Expiracion automatica por tiempo
- [ ] V1-F3-009: Historial y detalle de resultados del estudiante
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
