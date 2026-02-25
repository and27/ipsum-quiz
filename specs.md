ESPECIFICACIÓN FUNCIONAL – PLATAFORMA DE SIMULADORES ACADÉMICOS (V1)

Propósito del sistema
Construir una plataforma de simuladores tipo examen para estudiantes, con autenticación por correo y contraseña, acceso por simulador mediante código, temporizador, navegación configurable, preguntas de opción única con única respuesta correcta, soporte de imágenes en preguntas, control de intentos configurable por simulador, resultados por tema y total, panel administrador para gestionar simuladores y banco de preguntas, y reportes administrativos.

Roles y permisos
Administrador (admin)
Puede crear, editar y publicar simuladores. Puede crear y administrar preguntas y opciones, marcar la opción correcta, asignar temas/categorías, ordenar preguntas dentro de un simulador, configurar duración, intentos máximos, código de acceso y reglas de navegación. Puede ver reportes de resultados por simulador y por estudiante.

Estudiante (student)
Puede registrarse e iniciar sesión con correo y contraseña. Puede seleccionar un simulador publicado, ingresar el código de acceso si aplica, rendir el simulador dentro del tiempo permitido, responder preguntas, finalizar o quedar finalizado automáticamente al acabarse el tiempo, y ver sus resultados (total y por tema). Puede ver su historial de intentos propios.

Entidades principales del sistema
Simulador
Representa un examen publicado con un conjunto fijo de preguntas y configuraciones propias.

Tema/Categoría
Etiqueta que identifica el tema de cada pregunta (ejemplo: Sociales, Lengua, Abstracto, Matemáticas, CCNN). Se usa para resultados y reportes.

Pregunta
Elemento del banco de preguntas. Contiene enunciado y opcionalmente una imagen asociada.

Opción
Posibles respuestas para una pregunta. Cada pregunta tiene varias opciones y exactamente una es la correcta. La selección del estudiante es única (no multiselección).

Intento (Attempt)
Ejecución individual de un simulador por un estudiante. Guarda el inicio, fin, estado, respuestas, puntajes y desglose por tema. Se usa para temporizador real y control de intentos.

Respuesta
Selección realizada por el estudiante para una pregunta durante un intento.

Funcionalidades del estudiante

Acceso y autenticación
El estudiante debe poder registrarse con correo y contraseña e iniciar sesión con las mismas credenciales. No existe modo invitado sin cuenta.

Selección de simulador
El estudiante ve un listado de simuladores publicados y puede seleccionar uno para rendir.

Acceso por código de simulador
Al seleccionar un simulador, el sistema solicita un código o contraseña de acceso del simulador si el administrador lo configuró. Si el código es incorrecto no se permite iniciar el intento.

Control de intentos por simulador
Cada simulador tiene un máximo de intentos por estudiante configurable por el administrador. El valor por defecto es 3, pero puede ser cualquier número. Si el estudiante ya agotó sus intentos, el sistema debe impedir iniciar un intento adicional y mostrar un mensaje claro.

Inicio de intento
Al iniciar, el sistema crea un intento con hora de inicio y tiempo de fin calculado según la duración configurada del simulador. El temporizador debe mostrarse siempre visible en pantalla y reflejar el tiempo restante.

Temporizador y cierre automático
El intento termina cuando el estudiante presiona “Finalizar” o cuando el tiempo llega a cero. Al terminar automáticamente por tiempo, el sistema debe guardar el intento como finalizado y calcular resultados con las respuestas registradas hasta ese momento.

Presentación de preguntas
Las preguntas de cada simulador no son aleatorias. Cada simulador se publica con un conjunto fijo de preguntas y un orden definido por el administrador. Debe mostrarse el número actual y el total (ej. 10/60). Debe mostrarse también el tema/categoría de la pregunta actual.

Opción única
El estudiante puede seleccionar solo una opción por pregunta. Debe poder cambiar su respuesta mientras el intento esté activo.

Vaciar respuesta
Debe existir una acción para limpiar la respuesta seleccionada de la pregunta actual.

Navegación configurable (retroceder sí/no)
El administrador define por simulador si el estudiante puede o no regresar a preguntas anteriores. Si está desactivado, el sistema no debe permitir navegar hacia atrás ni seleccionar preguntas previas desde el panel de progreso.

Componente de progreso en vivo
Durante el intento se muestra un componente de progreso en tiempo real, similar a un tablero de ítems numerados, que refleje estado por pregunta. Debe indicar al menos: pregunta actual, preguntas respondidas y preguntas pendientes. El componente debe actualizarse conforme el estudiante responde.

Persistencia de respuestas
Las respuestas del estudiante deben guardarse durante el intento para evitar pérdida de progreso por recarga o cierre accidental, siempre que el intento esté activo.

Resultados al finalizar
Al finalizar el intento, el estudiante ve un resumen con: puntaje total y desglose por tema/categoría. Ejemplo: Matemáticas 14/14, Lengua 12/14, etc. Debe poder acceder a su historial de intentos y ver resultados anteriores propios.

Soporte de imágenes
Una pregunta puede incluir opcionalmente una imagen. El estudiante debe ver la imagen si existe. Las opciones pueden ser texto y opcionalmente soportar imagen si se requiere.

Funcionalidades del administrador

Gestión de simuladores
El administrador puede crear simuladores y configurar: nombre/título, duración, código de acceso (si aplica), máximo de intentos por estudiante, regla de navegación (permitir o no regresar), y estado (borrador/publicado). Un simulador no publicado no debe ser visible para estudiantes.

Asignación fija de preguntas al simulador
El administrador arma el set del simulador: añade preguntas y define el orden exacto (posición 1..N). El sistema debe permitir reordenar. Al publicar, el set queda definido para ese simulador.

Validaciones antes de publicar
Antes de permitir publicar un simulador, el sistema debe validar que: el simulador tiene preguntas asignadas y el orden está completo; cada pregunta del simulador tiene opciones válidas; y cada pregunta tiene exactamente una opción marcada como correcta.

Banco de preguntas
El administrador puede crear y editar preguntas asignándoles un tema/categoría, enunciado, imagen opcional, y opciones. Debe poder marcar cuál opción es la correcta (exactamente una). Debe poder activar/desactivar preguntas si necesita retirarlas del uso.

Reportes administrativos (V1)
El administrador debe tener un módulo de reportes que permita revisar resultados sin exportación. Debe incluir como mínimo: vista por simulador mostrando intentos realizados, puntaje promedio y desglose por tema; vista por estudiante mostrando historial de intentos, puntajes por tema y total; posibilidad de filtrar por simulador y por estudiante.

Reglas adicionales de consistencia y seguridad funcional
El estudiante no debe tener acceso visible a cuál es la opción correcta. El cálculo de resultados debe realizarse solo al finalizar el intento o cuando expira el tiempo. Una vez finalizado un intento, no se permite modificar respuestas. El sistema debe impedir iniciar intentos si el simulador está despublicado o fuera de disponibilidad si el administrador definió restricciones de acceso.

Criterios de aceptación (V1)
Un administrador puede crear un simulador completo, asignar preguntas en orden, configurar duración, intentos y navegación, y publicarlo. Un estudiante puede registrarse, ingresar, seleccionar simulador, ingresar código si corresponde, rendir con temporizador, responder con opción única, ver progreso en vivo, finalizar y ver resultados por tema y total. El administrador puede ver reportes de resultados por simulador y por estudiante
