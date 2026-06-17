[← Volver al índice](INDEX.md)

# API Reference — Profesor MS

> **Nota para IA:** `profesor_id` va en body (POST/PUT) o query param (GET/DELETE). Es el ID de `tbl_m_profesor`.

**Base URL:** `http://localhost:8085/api/profesor`

---

## Dashboard

### `GET /dashboard`
Estadísticas principales del panel docente (HU9).

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `profesor_id` | `number` | ID del profesor en `tbl_m_profesor` |

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "total_estudiantes": 45,
    "total_cuestionarios": 12,
    "total_materias": 3,
    "partidas_pendientes": [
      {
        "id_partida": 7,
        "codigo_acceso": "AB12CD",
        "estado_partida": "esperando",
        "titulo_prueba": "Fracciones básicas",
        "fecha_creacion": "2026-06-11T14:00:00Z"
      }
    ],
    "materias": [
      {
        "id_profesor_materia": 2,
        "materia": "Matemáticas",
        "periodo": "2026-I",
        "es_activo": true
      }
    ]
  }
}
```

---

### `GET /dashboard/graficas`
Datos para las tres gráficas del dashboard (HU16).

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "barra_horizontal": [
      { "estudiante": "Juan Pérez", "puntaje_promedio": 720 }
    ],
    "barra_vertical": [
      { "quiz": "Fracciones básicas", "puntaje_promedio": 650 }
    ],
    "distribucion_puntajes": [
      { "rango": "0-20", "cantidad": 2 },
      { "rango": "21-40", "cantidad": 5 },
      { "rango": "41-60", "cantidad": 8 },
      { "rango": "61-80", "cantidad": 15 },
      { "rango": "81-100", "cantidad": 10 }
    ]
  }
}
```

---

## Cuestionarios

### `GET /cuestionarios`
Lista paginada de cuestionarios del profesor (HU12).

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `profesor_id` | `number` | ID del profesor (requerido) |
| `page` | `number` | Página (default: 1) |
| `limit` | `number` | Registros por página (default: 20) |
| `materia_id` | `number` | Filtrar por materia |

**Respuesta 200:**
```json
{
  "success": true,
  "data": [ { "id_prueba": 1, "titulo": "...", "total_preguntas": 8, "materia": "Ciencias", "fecha_creacion": "..." } ],
  "meta": { "total": 12, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

### `POST /cuestionarios`
Crea un cuestionario — manual o por IA según el flag `esIA` (HU10/HU11). Las preguntas siguen el formato GBNF (`questions`, `question`, `answers`, `solutions`).

**Body:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `profesor_id` | `number` | Sí | ID del profesor |
| `materia_id` | `number` | Sí | ID de la materia |
| `title` | `string` | Sí | Título del cuestionario |
| `questions` | `array` | Sí | Lista de preguntas (formato GBNF) |
| `esIA` | `boolean` | No | `true` para marcar como generado por IA |
| `descripcion` | `string` | No | Descripción (modo IA: se sobrescribe con `"IA"`) |
| `configuracion` | `object` | No | Configuración adicional |

Cada pregunta en `questions`:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `question` | `string` | Sí | Texto de la pregunta |
| `options` | `string[]` | Sí | Opciones de respuesta (2–4) |
| `solutions` | `number[]` | Sí | Índices de respuestas correctas (al menos 1) |
| `cooldown` | `number` | Sí | Segundos de espera antes de mostrar resultados |
| `time` | `number` | Sí | Tiempo límite en segundos |
| `image` | `string` | No | URL de imagen asociada |

```json
{
  "profesor_id": 5,
  "materia_id": 3,
  "title": "Fracciones básicas",
  "questions": [
    {
      "question": "¿Cuánto es 1/2 + 1/4?",
      "options": ["3/4", "1/2"],
      "solutions": [0],
      "cooldown": 5,
      "time": 30
    }
  ]
}
```

**Modo IA (`esIA: true`):** el backend marca `descripcion = "IA"` para identificar el origen.

**Validaciones:**
- `title` requerido
- Mínimo 1 pregunta, máximo 20
- Cada pregunta con ≥2 respuestas y al menos 1 solución válida
- `cooldown` entero ≥ 0, `time` entero > 0

**Respuesta 201:**
```json
{ "success": true, "message": "Cuestionario creado" }
```

---

### `POST /preguntas`
Importa un cuestionario generado por IA o manual en formato GBNF (HU10/HU11). El body sigue la gramática definida en `quiz_generation.gbnf`.

**Body:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `subject` | `string` | Sí | Materia del cuestionario |
| `questions` | `array` | Sí | Lista de preguntas |
| `origen` | `string` | Sí | `"IA"` o `"MANUAL"` |

Cada pregunta en `questions`:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `question` | `string` | Sí | Texto de la pregunta |
| `options` | `string[]` | Sí | Opciones de respuesta (2–4) |
| `solutions` | `number[]` | Sí | Índices de respuestas correctas (al menos 1) |
| `cooldown` | `number` | Sí | Segundos de espera antes de mostrar resultados |
| `time` | `number` | Sí | Tiempo límite en segundos |
| `image` | `string` | No | URL de imagen asociada |

```json
{
  "subject": "Ciencias",
  "questions": [
    {
      "question": "¿Cuál es la fórmula química del agua?",
      "options": ["H2O", "CO2", "NaCl", "O2"],
      "solutions": [0],
      "cooldown": 5,
      "time": 20
    }
  ],
  "origen": "IA"
}
```

**Validaciones:**
- `subject` requerido
- Mínimo 1 pregunta
- Cada pregunta con ≥2 respuestas y al menos 1 solución válida
- `cooldown` entero ≥ 0, `time` entero > 0

**Respuesta 201:**
```json
{ "success": true, "message": "Preguntas importadas" }
```

---

### `GET /cuestionarios/:id`
Detalle de un cuestionario con todas sus preguntas y opciones (HU12).

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "id_prueba": 1,
    "titulo": "Fracciones básicas",
    "descripcion": "...",
    "configuracion": {},
    "tbl_t_profesor_materia": { "tbl_m_materia": { "nombre": "Matemáticas" } },
    "tbl_t_pregunta": [
      {
        "id_pregunta": 10,
        "texto": "¿Cuánto es 1/2 + 1/4?",
        "tiempo_limite": 30,
        "cooldown": 5,
        "image_url": null,
        "tbl_t_opcion": [
          { "id_opcion": 40, "texto": "3/4", "orden": 1, "es_correcta": true },
          { "id_opcion": 41, "texto": "1/2", "orden": 2, "es_correcta": false }
        ]
      }
    ]
  }
}
```

---

### `PUT /cuestionarios/:id`
Actualiza título, descripción, configuración o preguntas (HU12). Las preguntas siguen el formato GBNF.

**Body (todos los campos opcionales):**

Cada pregunta en `questions` puede incluir `id` (existente) para actualizar, u omitirlo para crear una nueva.

```json
{
  "titulo": "Nuevo título",
  "questions": [
    { "id": 10, "question": "Texto actualizado", "options": ["3/4", "1/2"], "solutions": [0], "cooldown": 5, "time": 45 },
    { "question": "Nueva pregunta", "options": ["Sí", "No"], "solutions": [0], "cooldown": 5, "time": 20 }
  ]
}
```

**Respuesta 200:**
```json
{ "success": true, "message": "Cuestionario actualizado" }
```

---

### `DELETE /cuestionarios/:id`
Elimina (soft delete) un cuestionario (HU12).

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{ "success": true, "message": "Cuestionario eliminado" }
```

---

## Partidas (Sesiones de quiz)

### `GET /partidas`
Historial de todas las partidas del profesor (HU15).

**Query params:** `profesor_id`, `page`, `limit`, `prueba_id`

**Respuesta 200:**
```json
{
  "success": true,
  "data": [
    {
      "id_partida": 5,
      "codigo_acceso": "XY9Z12",
      "estado_partida": "finalizada",
      "titulo_prueba": "Fracciones",
      "total_participantes": 22,
      "iniciado_en": "2026-06-10T09:00:00Z",
      "finalizado_en": "2026-06-10T09:25:00Z"
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

### `POST /partidas`
Crea una nueva sesión de quiz a partir de un cuestionario (HU13). Genera el código de acceso automáticamente.

**Body:**
```json
{ "profesor_id": 5, "prueba_id": 1 }
```

**Respuesta 201:**
```json
{ "success": true, "message": "Partida creada" }
```

---

### `GET /partidas/:id`
Detalle de una partida con sus preguntas y preguntas de la prueba.

**Query params:** `profesor_id` (number)

---

### `PUT /partidas/:id/iniciar`
Inicia la partida (estado `esperando` → `en_curso`). Emite evento Socket.io `partida:iniciada`.

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{ "success": true, "data": { "id_partida": 9, "estado_partida": "en_curso", "iniciado_en": "..." } }
```

**Error 400** si `estado_partida !== 'esperando'`.

---

### `PUT /partidas/:id/siguiente-pregunta`
Avanza a la siguiente pregunta. Emite `partida:pregunta` por Socket.io **sin `es_correcta`** a los estudiantes.

**Query params:** `profesor_id` (number)

**Respuesta 200:** Pregunta actual con opciones **incluyendo `es_correcta`** (solo para el profesor).

```json
{
  "success": true,
  "data": {
    "id_pregunta": 10,
    "texto": "¿Cuánto es 1/2 + 1/4?",
    "tiempo_limite": 30,
    "numero": 1,
    "total": 8,
    "opciones": [
      { "id_opcion": 40, "texto": "3/4", "orden": 1, "es_correcta": true },
      { "id_opcion": 41, "texto": "1/2", "orden": 2, "es_correcta": false }
    ]
  }
}
```

**Error 400** si ya no hay más preguntas (llamar `/finalizar`).

---

### `PUT /partidas/:id/finalizar`
Finaliza la partida (cualquier estado → `finalizada`). Emite `partida:finalizada`.

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{ "success": true, "data": { "id_partida": 9, "estado_partida": "finalizada", "finalizado_en": "..." } }
```

---

### `GET /partidas/:id/resultados`
Resultados completos de la partida con detalle por estudiante (HU14).

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "id_partida": 9,
    "prueba": { "titulo": "Fracciones", "total_preguntas": 8 },
    "total_participantes": 22,
    "participaciones": [
      {
        "posicion": 1,
        "nombre": "Ana García",
        "puntaje_total": 7800,
        "respuestas_correctas": 7,
        "respuestas": [
          { "pregunta": "¿Cuánto es 1/2 + 1/4?", "opcion_elegida": "3/4", "fue_correcta": true, "puntaje_obtenido": 980, "tiempo_ms": 4200 }
        ]
      }
    ]
  }
}
```

---

### `GET /partidas/:id/ranking`
Ranking ordenado por puntaje descendente (HU14).

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{
  "success": true,
  "data": [
    { "posicion": 1, "nombre": "Ana García", "puntaje_total": 7800, "respuestas_correctas": 7 },
    { "posicion": 2, "nombre": "Carlos López", "puntaje_total": 6500, "respuestas_correctas": 6 }
  ]
}
```

---

## Materias

### `GET /materias`
Lista de materias asignadas al profesor con estadísticas.

**Query params:** `profesor_id` (number)

**Respuesta 200:**
```json
{
  "success": true,
  "data": [
    {
      "id_profesor_materia": 2,
      "materia": { "id_materia": 5, "nombre": "Matemáticas", "grado": "4A" },
      "periodo": "2026-I",
      "es_activo": true,
      "total_estudiantes": 30,
      "total_cuestionarios": 5
    }
  ]
}
```

---

### `GET /materias/:id`
Detalle de una materia asignada, incluyendo lista de estudiantes matriculados.

**Query params:** `profesor_id` (number)

---

## Socket.io — Eventos

**Conexión:** `ws://localhost:8085` (mismo puerto que HTTP)

### Eventos del cliente al servidor

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `teacher:join` | `{ partida_id }` | Profesor se une a la sala |
| `student:join` | `{ partida_id, nickname }` | Estudiante se une a la sala |
| `respuesta:enviar` | `{ partida_id, partida_estudiante_id, pregunta_id, opcion_id, tiempo_ms }` | Estudiante envía respuesta |

### Eventos del servidor al cliente

| Evento | Payload | A quién |
|--------|---------|---------|
| `student:joined` | `{ nickname, socket_id }` | Sala completa |
| `partida:iniciada` | `{ id_partida, estado_partida }` | Sala completa |
| `partida:pregunta` | Pregunta sin `es_correcta` | Sala completa |
| `partida:finalizada` | `{ id_partida, finalizado_en }` | Sala completa |
| `respuesta:recibida` | `{ partida_estudiante_id, pregunta_id, tiempo_ms }` | Sala completa (sin opción elegida) |

---

## Códigos de error comunes

| Código | Descripción |
|--------|-------------|
| 400 | Validación fallida (campo requerido, estado incorrecto) |
| 401 | No autenticado |
| 403 | Rol incorrecto (no es PROFESOR) |
| 404 | Recurso no encontrado o sin permisos |
| 409 | Violación de unicidad (Prisma P2002) |
| 502 | Error en servicio externo (ms-rag) |
| 503 | Servicio externo no disponible |
| 500 | Error interno |

---

## Instrucciones para actualizar este doc
- Si añades un endpoint → añade su sección con método, ruta, body, respuesta y errores.
- Si cambian validaciones → actualiza la sección correspondiente.
- Si cambian eventos Socket.io → actualiza la tabla de eventos.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
