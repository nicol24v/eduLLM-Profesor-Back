[← Volver al índice](INDEX.md)

# API Reference — Profesor MS

> **Nota para IA:** Todos los endpoints requieren que el Gateway inyecte los headers `X-User-Id`, `X-User-Role` y `X-Username`. El middleware `requireProfesor` rechaza peticiones donde `X-User-Role != PROFESOR`.

**Base URL:** `http://localhost:8085/api/profesor`

---

## Dashboard

### `GET /dashboard`
Estadísticas principales del panel docente (HU9).

**Headers requeridos:** `X-User-Id`, `X-User-Role: PROFESOR`

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
Crea un cuestionario manualmente (HU10).

**Body:**
```json
{
  "titulo": "Fracciones básicas",
  "descripcion": "Cuestionario de repaso",
  "profesor_materia_id": 3,
  "configuracion": { "mostrar_puntaje": true },
  "preguntas": [
    {
      "texto": "¿Cuánto es 1/2 + 1/4?",
      "tipo": "single_choice",
      "tiempo_limite": 30,
      "cooldown": 5,
      "image_url": null,
      "audio_url": null,
      "video_url": null,
      "opciones": [
        { "texto": "3/4", "orden": 1, "es_correcta": true },
        { "texto": "1/2", "orden": 2, "es_correcta": false },
        { "texto": "1/4", "orden": 3, "es_correcta": false },
        { "texto": "2/3", "orden": 4, "es_correcta": false }
      ]
    }
  ]
}
```

**Validaciones:**
- `titulo` requerido
- `profesor_materia_id` debe pertenecer al profesor autenticado
- Mínimo 1 pregunta, máximo 20
- Cada pregunta con ≥2 opciones y exactamente 1 `es_correcta: true`

**Respuesta 201:** Cuestionario completo con preguntas y opciones.

---

### `POST /cuestionarios/ia`
Genera un cuestionario usando IA/RAG (HU11).

**Body:**
```json
{
  "tema": "Sistema solar",
  "profesor_materia_id": 3,
  "cantidad_preguntas": 5
}
```

> Llama a `RAG_SERVICE_URL/api/rag/generate-quiz`. Si el servicio no está disponible responde `503`.

**Respuesta 201:** Cuestionario creado y persistido (mismo formato que `POST /cuestionarios`).

---

### `GET /cuestionarios/:id`
Detalle de un cuestionario con todas sus preguntas y opciones (HU12).

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
Actualiza título, descripción, configuración o preguntas (HU12).

**Body (todos los campos opcionales):**
```json
{
  "titulo": "Nuevo título",
  "preguntas": [
    { "id_pregunta": 10, "texto": "Texto actualizado", "tiempo_limite": 45,
      "opciones": [{ "id_opcion": 40, "texto": "3/4", "orden": 1, "es_correcta": true }] },
    { "texto": "Nueva pregunta sin id", "tiempo_limite": 20,
      "opciones": [{ "texto": "Sí", "orden": 1, "es_correcta": true }, { "texto": "No", "orden": 2, "es_correcta": false }] }
  ]
}
```

---

### `DELETE /cuestionarios/:id`
Elimina (soft delete) un cuestionario (HU12).

**Respuesta 200:**
```json
{ "success": true, "message": "Cuestionario eliminado" }
```

---

## Partidas (Sesiones de quiz)

### `GET /partidas`
Historial de todas las partidas del profesor (HU15).

**Query params:** `page`, `limit`, `prueba_id`

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
{ "prueba_id": 1 }
```

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "id_partida": 9,
    "codigo_acceso": "MN4T7R",
    "estado_partida": "esperando",
    "titulo_prueba": "Fracciones básicas",
    "total_preguntas": 8,
    "fecha_creacion": "2026-06-11T15:00:00Z"
  }
}
```

---

### `GET /partidas/:id`
Detalle de una partida con sus preguntas y preguntas de la prueba.

---

### `PUT /partidas/:id/iniciar`
Inicia la partida (estado `esperando` → `en_curso`). Emite evento Socket.io `partida:iniciada`.

**Respuesta 200:**
```json
{ "success": true, "data": { "id_partida": 9, "estado_partida": "en_curso", "iniciado_en": "..." } }
```

**Error 400** si `estado_partida !== 'esperando'`.

---

### `PUT /partidas/:id/siguiente-pregunta`
Avanza a la siguiente pregunta. Emite `partida:pregunta` por Socket.io **sin `es_correcta`** a los estudiantes.

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

**Respuesta 200:**
```json
{ "success": true, "data": { "id_partida": 9, "estado_partida": "finalizada", "finalizado_en": "..." } }
```

---

### `GET /partidas/:id/resultados`
Resultados completos de la partida con detalle por estudiante (HU14).

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
| 401 | No autenticado (sin headers del gateway) |
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
