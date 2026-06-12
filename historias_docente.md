# Historias de Usuario — Docente

*Plataforma web para la generación, evaluación y retroalimentación de cuestionarios de Ciencias Naturales mediante IA generativa y técnicas RAG*

---

## HU9 — Dashboard principal del Docente

| Campo | Detalle |
|---|---|
| **Nombre** | Dashboard principal del Docente |
| **Usuario** | Docente |
| **Fase asignada** | Fase 2 |
| **Prioridad en Negocio** | Alta |
| **Riesgo de Desarrollo** | Bajo |
| **Puntos Estimados** | 5 |

**Descripción:**
Como docente, quiero ver un panel principal con información relevante de mi materia y cuestionarios para organizar mi trabajo diario de forma eficiente.

**Criterios de Aceptación:**
- El dashboard muestra el total de estudiantes asignados a la materia.
- Muestra el número de cuestionarios creados.
- Presenta una lista de los cuestionarios pendientes con su nombre y estado.
- Incluye acceso rápido para crear un nuevo cuestionario.
- Muestra el nombre de la materia asignada al docente.
- Incluye la opción de cerrar sesión visible desde el dashboard.

**Tareas Técnicas:**
- Diseñar e implementar la vista del dashboard del docente.
- Crear contadores de estudiantes y cuestionarios.
- Implementar listado de cuestionarios pendientes.
- Añadir acceso rápido a creación de cuestionario y cierre de sesión.

**Entregable:** Dashboard principal del docente con indicadores, lista de cuestionarios pendientes y accesos rápidos.

---

## HU10 — Creación manual de cuestionarios

| Campo | Detalle |
|---|---|
| **Nombre** | Creación manual de cuestionarios |
| **Usuario** | Docente |
| **Fase asignada** | Fase 2 |
| **Prioridad en Negocio** | Alta |
| **Riesgo de Desarrollo** | Medio |
| **Puntos Estimados** | 8 |

**Descripción:**
Como docente, quiero crear cuestionarios manualmente con preguntas de opción múltiple para evaluar a mis estudiantes sobre temas y subtemas específicos de Ciencias Naturales.

**Criterios de Aceptación:**
- El cuestionario tiene nombre, tema o subtema al que pertenece.
- Cada cuestionario tiene entre 5 preguntas como mínimo y 10 preguntas como máximo.
- Cada pregunta tiene hasta 4 opciones de respuesta con solo una correcta.
- Cada pregunta puede tener un tiempo límite opcional de 5 a 20 segundos.
- Se puede adjuntar una imagen o video opcional a cada pregunta.
- El cuestionario genera automáticamente un código de acceso numérico de máximo 8 dígitos.
- El docente puede guardar el cuestionario como borrador o guardarlo en su biblioteca.

**Tareas Técnicas:**
- Crear formulario de creación de cuestionario con campos de nombre y tema.
- Implementar módulo de preguntas con opciones, respuesta correcta y temporizador opcional.
- Implementar carga de imagen o video por pregunta.
- Generar automáticamente código de acceso único al guardar.
- Implementar guardado como borrador y publicación del cuestionario.

**Entregable:** Módulo de creación manual de cuestionarios con preguntas multimedia y código de acceso generado.

---

## HU11 — Creación de cuestionarios con IA generativa

| Campo | Detalle |
|---|---|
| **Nombre** | Creación de cuestionarios con IA generativa |
| **Usuario** | Docente |
| **Fase asignada** | Fase 3 |
| **Prioridad en Negocio** | Alta |
| **Riesgo de Desarrollo** | Alto |
| **Puntos Estimados** | 13 |

**Descripción:**
Como docente, quiero generar preguntas automáticamente usando IA generativa basada en el libro de Ciencias Naturales para ahorrar tiempo al crear cuestionarios.

**Criterios de Aceptación:**
- El docente puede especificar el tema o subtema sobre el que desea generar preguntas.
- La IA genera entre 5 y 10 preguntas de opción múltiple con solo una respuesta correcta según el número requerido.
- Las preguntas generadas se muestran para revisión antes de guardar el cuestionario.
- El docente puede editar, eliminar o agregar preguntas antes de guardar.
- El sistema utiliza el libro de Ciencias Naturales como fuente.
- El cuestionario generado sigue el mismo formato que el creado manualmente.

**Tareas Técnicas:**
- Integrar modelo de IA generativa con el sistema.
- Implementar pipeline RAG sobre el libro de Ciencias Naturales.
- Crear interfaz para ingresar tema y generar preguntas.
- Mostrar preguntas generadas con opción de editar, eliminar o agregar.
- Conectar el resultado con el flujo de guardado de cuestionarios manuales.

**Entregable:** Módulo de generación de preguntas con IA generativa integrado al flujo de creación de cuestionarios.

---

## HU12 — Gestión de cuestionarios (editar, eliminar, listar)

| Campo | Detalle |
|---|---|
| **Nombre** | Gestión de cuestionarios (editar, eliminar, listar) |
| **Usuario** | Docente |
| **Fase asignada** | Fase 2 |
| **Prioridad en Negocio** | Alta |
| **Riesgo de Desarrollo** | Bajo |
| **Puntos Estimados** | 5 |

**Descripción:**
Como docente, quiero poder listar, editar y eliminar mis cuestionarios almacenados para mantener organizado mi banco de evaluaciones.

**Criterios de Aceptación:**
- El docente visualiza una lista de todos sus cuestionarios con nombre, tema y estado.
- Puede editar cualquier cuestionario antes de iniciarlo.
- Puede eliminar un cuestionario que ya no necesite.
- Puede ver el detalle completo de un cuestionario.
- Los cuestionarios ya iniciados no pueden editarse, solo visualizarse.

**Tareas Técnicas:**
- Crear vista de listado de cuestionarios con filtros por estado.
- Implementar funcionalidad de edición de cuestionario existente.
- Implementar funcionalidad de eliminación de cuestionario.
- Crear vista de detalle de cuestionario.
- Bloquear edición de cuestionarios que ya fueron iniciados.

**Entregable:** Módulo de gestión de cuestionarios con listado, edición, eliminación y vista de detalle.

---

## HU13 — Ejecución del cuestionario en tiempo real controlado por el Docente

| Campo | Detalle |
|---|---|
| **Nombre** | Ejecución del cuestionario en tiempo real controlado por el Docente |
| **Usuario** | Docente |
| **Fase asignada** | Fase 4 |
| **Prioridad en Negocio** | Alta |
| **Riesgo de Desarrollo** | Alto |
| **Puntos Estimados** | 13 |

**Descripción:**
Como docente, quiero controlar la presentación del cuestionario en tiempo real para que todos los estudiantes vean y respondan la misma pregunta al mismo tiempo bajo mi dirección.

**Criterios de Aceptación:**
- El docente inicia el cuestionario desde su interfaz.
- Los estudiantes conectados pueden ver la pregunta activa en tiempo real.
- El docente avanza manualmente a la siguiente pregunta.
- Se muestra el temporizador por pregunta visible para el docente y los estudiantes.
- El docente puede ver cuántos estudiantes han respondido la pregunta actual.
- Al finalizar todas las preguntas, el sistema cierra automáticamente el cuestionario.

**Tareas Técnicas:**
- Implementar comunicación en tiempo real con Socket.io.
- Crear sala de sesión del cuestionario vinculada al código de acceso.
- Implementar control de avance de preguntas desde la vista del docente.
- Sincronizar el temporizador entre docente y estudiantes.
- Mostrar contador de respuestas recibidas al docente en tiempo real.

**Entregable:** Sistema de ejecución de cuestionarios en tiempo real con control del docente mediante Socket.io.

---

## HU14 — Visualización de resultados y ranking completo — Docente

| Campo | Detalle |
|---|---|
| **Nombre** | Visualización de resultados y ranking completo — Docente |
| **Usuario** | Docente |
| **Fase asignada** | Fase 5 |
| **Prioridad en Negocio** | Alta |
| **Riesgo de Desarrollo** | Medio |
| **Puntos Estimados** | 5 |

**Descripción:**
Como docente, quiero ver la tabla completa de resultados y posiciones de todos los estudiantes al finalizar el cuestionario para evaluar el desempeño general del grupo.

**Criterios de Aceptación:**
- Al finalizar el cuestionario el docente puede ver la tabla completa de posiciones con puntajes de todos los estudiantes.
- Los resultados se muestran de forma inmediata al cerrar el cuestionario.
- La tabla está ordenada de mayor a menor puntaje.
- Los resultados quedan registrados en el historial del docente.
- Se muestra el nombre del estudiante, su puntaje y su posición en el ranking.

**Tareas Técnicas:**
- Calcular y almacenar el puntaje de cada estudiante al finalizar el cuestionario.
- Implementar vista de ranking completo para el docente ordenado por puntaje.
- Mostrar animación de resultados al finalizar.
- Guardar los resultados en el historial del docente.

**Entregable:** Pantalla de resultados del docente con tabla completa de posiciones y puntajes de todos los estudiantes.

---

## HU15 — Historial de cuestionarios del Docente

| Campo | Detalle |
|---|---|
| **Nombre** | Historial de cuestionarios del Docente |
| **Usuario** | Docente |
| **Fase asignada** | Fase 6 |
| **Prioridad en Negocio** | Media |
| **Riesgo de Desarrollo** | Bajo |
| **Puntos Estimados** | 3 |

**Descripción:**
Como docente, quiero acceder al historial de cuestionarios aplicados para revisar los que he realizado anteriormente y consultar su contenido.

**Criterios de Aceptación:**
- El docente puede ver una lista de todos los cuestionarios aplicados ordenados por fecha.
- Puede acceder al detalle de cada cuestionario para ver sus preguntas.
- Se indica la fecha en que fue aplicado cada cuestionario.
- Se muestra el número de estudiantes que participaron en cada cuestionario.

**Tareas Técnicas:**
- Crear vista de historial de cuestionarios aplicados.
- Implementar navegación al detalle de cada cuestionario desde el historial.
- Mostrar metadatos del cuestionario: fecha, participantes y tema.

**Entregable:** Vista de historial de cuestionarios del docente con acceso a detalle de cada uno.

---

## HU16 — Dashboard del Docente con gráficos de resultados

| Campo | Detalle |
|---|---|
| **Nombre** | Dashboard del Docente con gráficos de resultados |
| **Usuario** | Docente |
| **Fase asignada** | Fase 6 |
| **Prioridad en Negocio** | Media |
| **Riesgo de Desarrollo** | Medio |
| **Puntos Estimados** | 8 |

**Descripción:**
Como docente, quiero ver gráficos de resultados de los cuestionarios aplicados para analizar el desempeño de mis estudiantes de forma visual.

**Criterios de Aceptación:**
- Se muestra un gráfico de barras horizontales con los puntajes por estudiante.
- Se muestra un gráfico de barras verticales con el promedio de resultados por cuestionario.
- Se muestra un gráfico de pastel con la distribución de rangos de puntaje (alto, medio, bajo).
- Los gráficos se actualizan al seleccionar un cuestionario diferente.
- El docente puede filtrar los resultados por cuestionario específico.

**Tareas Técnicas:**
- Integrar librería de gráficos en el frontend.
- Implementar gráfico de barras horizontales de puntajes por estudiante.
- Implementar gráfico de barras verticales de promedios por cuestionario.
- Implementar gráfico de pastel de distribución de puntajes.
- Crear filtro de selección de cuestionario para actualizar los gráficos.

**Entregable:** Sección de análisis en el dashboard del docente con tres tipos de gráficos de resultados.
