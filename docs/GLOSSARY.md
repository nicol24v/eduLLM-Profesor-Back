[← Volver al índice](INDEX.md)

# Glosario — Profesor MS

> Términos específicos del dominio educativo y del sistema eduLLM.

| Término | Definición |
|---------|------------|
| **Partida** | Sesión de quiz en tiempo real. Un profesor crea una partida a partir de un cuestionario; los estudiantes se unen usando el código de acceso. Equivalente a una "sala de juego". |
| **Prueba / Cuestionario** | Conjunto de preguntas creado por el profesor. Puede reutilizarse en múltiples partidas. Almacenado en `tbl_t_prueba`. |
| **Pregunta** | Ítem individual dentro de una prueba. Tiene un enunciado, tiempo límite, cooldown y opciones de respuesta. |
| **Opción** | Posible respuesta a una pregunta. Exactamente una opción por pregunta tiene `es_correcta = true`. |
| **Código de acceso** | Código alfanumérico de 6 caracteres generado automáticamente al crear una partida. Los estudiantes lo usan para unirse. |
| **Estado de partida** | Ciclo de vida de una sesión: `esperando` → `en_curso` → `finalizada`. |
| **profesor_materia** | Registro que vincula a un profesor con una materia en un periodo lectivo específico. Es la unidad de asignación docente. |
| **Periodo lectivo** | Año o semestre académico. Define cuándo está vigente una asignación. |
| **Grado** | Año escolar + paralelo (ej. "4A", "5B"). |
| **Materia** | Asignatura o curso académico (ej. "Matemáticas", "Ciencias Naturales"). |
| **Puntaje total** | Suma de los puntajes obtenidos en todas las respuestas de una partida. El máximo teórico es `total_preguntas × 1000`. |
| **Cooldown** | Tiempo en segundos de espera entre el fin de una pregunta y el inicio de la siguiente. |
| **Tiempo límite** | Segundos máximos que tiene un estudiante para responder una pregunta antes de que se contabilice como no respondida. |
| **RAG** | Retrieval-Augmented Generation — técnica de IA que combina recuperación de documentos (libro de Ciencias) con generación de texto para crear preguntas contextualizadas. |
| **Gateway** | Spring Cloud Gateway que actúa como puerta de entrada única. Valida JWT y redirige peticiones a los microservicios. |
| **Soft delete** | Eliminación lógica: el registro se marca con `estado = false` en lugar de borrarse físicamente de la BD. |
| **Ownership** | Propiedad de un recurso. Un profesor solo puede acceder/modificar sus propios cuestionarios y partidas. |
| **sessionStates** | Map en memoria que rastrea el índice de pregunta actual por partida activa. Se pierde en restart del servidor. |
| **HU** | Historia de Usuario — unidad de requerimiento funcional (HU9-HU16 son las del módulo docente). |
| **ms** | Microservicio — abreviatura usada en nombres de contenedores (ej. `rol-profesor-ms`). |

---

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
