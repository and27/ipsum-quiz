begin;

-- La pantalla de examen (getAttemptExamStateForStudent) carga todas las
-- preguntas + opciones de la version. Las policies RLS de esas tablas
-- (20260226_0009) verifican propiedad con un EXISTS contra public.attempts
-- filtrando por (student_id, simulator_version_id). Sin un indice por esas
-- columnas el planner hacia un Seq Scan sobre attempts re-ejecutado una vez por
-- fila (cientos de veces), lo que disparaba "canceling statement due to
-- statement timeout" al cargar el examen.
--
-- Este indice convierte ese Seq Scan en un Index (Only) Scan. Medido en prod:
-- la carga del examen bajo de ~4.3s a ~40ms.
--
-- NOTA: se aplico primero a mano en el SQL Editor de produccion; este archivo
-- existe para trazabilidad y para reconstruir el esquema desde cero. El
-- "if not exists" lo hace idempotente.

create index if not exists attempts_student_version_idx
  on public.attempts (student_id, simulator_version_id);

commit;

-- Recupera el bloat acumulado por alta rotacion de filas (p. ej. load tests).
-- VACUUM no puede correr dentro de una transaccion, por eso va fuera del
-- begin/commit. En operacion normal el autovacuum se encarga; esto es puntual.
vacuum analyze public.attempts;
