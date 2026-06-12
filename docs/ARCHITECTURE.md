[← Volver al índice](INDEX.md)

# Arquitectura — Profesor MS

> **Nota para IA:** Este archivo describe el diseño del sistema, los módulos internos y los flujos paso a paso. Úsalo para entender cómo viajan los datos desde la petición HTTP hasta la base de datos.

## Diagrama general

```
┌─────────────────────────────────────────────────────┐
│                  eduLLM Ecosystem                   │
│                                                     │
│  Frontend Profesor (:800x)                         │
│          │                                          │
│          ▼                                          │
│  Gateway (:8089) ──JWT validation──►               │
│     ├─ /api/profesor/** ─────────────► Profesor MS (:8085) ◄─── este servicio
│     ├─ /api/admin/**   ──────────────► Admin MS (:8083)
│     └─ /api/auth/**    ──────────────► Auth MS (:8082)
│                                                     │
│  Profesor MS (:8085)                               │
│     ├─ REST API  ── Express                        │
│     ├─ Socket.io ── mismo puerto                   │
│     └─ Prisma    ── PostgreSQL edu_llm             │
│                                                     │
│  RAG MS (:8002)  ←── llamadas HTTP desde Profesor MS (HU11)
└─────────────────────────────────────────────────────┘
```

## Capas internas

```
Request HTTP
    │
    ▼
[ Middlewares globales ]
    helmet · rateLimit · logRequest · cookieParser
    authMiddleware (lee X-User-Id, X-User-Role, X-Username)
    globalSanitizer
    │
    ▼
[ Routes /api/profesor/* ]
    requireProfesor (verifica rol)
    │
    ▼
[ Controller ]
    Extrae params/body · llama al Service · devuelve JSON
    │
    ▼
[ Service ]
    Lógica de negocio · validaciones · transacciones Prisma
    │
    ▼
[ Repository ]
    Queries Prisma reutilizables (findByIdWithPreguntas, findResultados…)
    │
    ▼
[ Prisma ORM ]  ──►  PostgreSQL (edu_llm, schema comun)
```

## Módulos

| Módulo | Archivos | Responsabilidad |
|--------|----------|-----------------|
| `dashboard` | `dashboard.controller.js`, `dashboard.service.js` | Estadísticas HU9, datos de gráficas HU16 |
| `cuestionario` | `cuestionario.controller.js`, `cuestionario.service.js`, `cuestionario.repository.js` | CRUD cuestionarios HU10-HU12, generación IA HU11 |
| `partida` | `partida.controller.js`, `partida.service.js`, `partida.repository.js` | Sesiones de quiz HU13, resultados HU14, historial HU15 |
| `materia` | `materia.controller.js`, `materia.service.js`, `materia.repository.js` | Materias asignadas al profesor |
| `socket` | `socket/socket.js` | Socket.io HU13: eventos tiempo real, estado en memoria |
| `middlewares` | `auth`, `requireProfesor`, `errorHandler`, `sanitize`, `logger` | Seguridad y transversales |

---

## Flujos principales

### Flujo HU9 — Dashboard principal

**Entrada:** `GET /api/profesor/dashboard` con headers `X-User-Id: 42`

1. `authMiddleware` → pone `req.user = { id_usuario: 42, rol: 'PROFESOR' }`
2. `requireProfesor` → valida `rol === 'PROFESOR'`
3. `dashboardController.getStats(req, res)`
4. `dashboardService.getDashboardStats(42)`:
   - Lee `tbl_m_profesor WHERE usuario_id = 42` → obtiene `id_profesor`
   - Lee `tbl_t_profesor_materia WHERE profesor_id = X` → lista materias asignadas
   - Cuenta `tbl_m_estudiante_materia` (distinct `id_estudiante`) → `total_estudiantes`
   - Cuenta `tbl_t_prueba WHERE profesor_materia_id IN (...)` → `total_cuestionarios`
   - Lee `tbl_t_partida WHERE estado_partida IN ('esperando','en_curso')` → pendientes
5. Devuelve JSON con `{ total_estudiantes, total_cuestionarios, total_materias, partidas_pendientes, materias }`

**Tablas leídas:** `tbl_m_profesor`, `tbl_t_profesor_materia`, `tbl_m_estudiante_materia`, `tbl_t_prueba`, `tbl_t_partida`

---

### Flujo HU10 — Crear cuestionario manual

**Entrada:** `POST /api/profesor/cuestionarios` con body JSON

```json
{
  "titulo": "Fracciones",
  "profesor_materia_id": 3,
  "preguntas": [
    {
      "texto": "¿Cuánto es 1/2 + 1/4?",
      "tiempo_limite": 30,
      "opciones": [
        { "texto": "3/4", "orden": 1, "es_correcta": true },
        { "texto": "1/2", "orden": 2, "es_correcta": false }
      ]
    }
  ]
}
```

1. `cuestionarioService.create(usuarioId, body)`:
   - Verifica que `profesor_materia_id` pertenece al profesor autenticado
   - Valida: `titulo` requerido, 1–20 preguntas, cada pregunta con ≥2 opciones y exactamente 1 correcta
2. Abre **transacción Prisma**:
   - Crea `tbl_t_prueba`
   - Por cada pregunta → crea `tbl_t_pregunta`
   - Por cada opción → crea `tbl_t_opcion`
3. Llama a `cuestionarioRepository.findByIdWithPreguntas(id)` y devuelve el cuestionario completo

**Tablas escritas:** `tbl_t_prueba`, `tbl_t_pregunta`, `tbl_t_opcion`

---

### Flujo HU11 — Crear cuestionario con IA

**Entrada:** `POST /api/profesor/cuestionarios/ia`

```json
{ "tema": "Sistema solar", "profesor_materia_id": 3, "cantidad_preguntas": 5 }
```

1. Valida `tema` y `profesor_materia_id`
2. Hace `fetch POST` a `RAG_SERVICE_URL/api/rag/generate-quiz` con `{ tema, materia, cantidad_preguntas }`
3. Si el RAG responde con el cuestionario generado → lo pasa a `create()` del mismo servicio
4. Se persiste igual que HU10

**Dependencia externa:** ms-rag en `RAG_SERVICE_URL`. Si no está disponible → `503`.

---

### Flujo HU13 — Ejecución de quiz en tiempo real

**Secuencia REST + Socket.io:**

```
Profesor                    Servidor                    Estudiantes
   │                            │                            │
   │─POST /partidas ───────────►│ Crea partida, código 6chr  │
   │◄── { codigo_acceso }───────│                            │
   │                            │                            │
   │─socket teacher:join ──────►│ Sala: partida:{id}         │
   │                            │◄─ student:join ────────────│
   │◄── student:joined ─────────│                            │
   │                            │                            │
   │─PUT /iniciar ─────────────►│ estado_partida = en_curso  │
   │                            │─► partida:iniciada ────────│
   │                            │                            │
   │─PUT /siguiente-pregunta ──►│ index++, pregunta sin resp │
   │◄── { pregunta + correcta } │─► partida:pregunta ────────│
   │                            │                            │
   │                            │◄─ respuesta:enviar ────────│
   │◄── respuesta:recibida ─────│                            │
   │                            │                            │
   │─PUT /finalizar ───────────►│ estado_partida = finalizada│
   │                            │─► partida:finalizada ──────│
   │                            │                            │
   │─GET /resultados ──────────►│                            │
   │◄── { ranking, detalle } ───│                            │
```

**Estado en memoria:** `sessionStates` Map en `socket/socket.js` — `partida_id → { preguntaIndex, totalPreguntas }`. Se pierde en restart; no es crítico porque el profesor puede reiniciar.

**Tablas escritas:** `tbl_t_partida` (estado_partida, iniciado_en, finalizado_en)

---

### Flujo HU16 — Gráficas del dashboard

**Entrada:** `GET /api/profesor/dashboard/graficas`

1. Obtiene todas las partidas finalizadas del profesor
2. Consulta `tbl_t_partida_estudiante` con sus `puntaje_total`
3. Agrupa por estudiante → **barra horizontal** (promedio por alumno)
4. Agrupa por prueba → **barra vertical** (promedio por quiz)
5. Normaliza scores contra `(total_preguntas × 1000)` → **torta** de distribución en rangos 0-20%, 21-40%, 41-60%, 61-80%, 81-100%

**Tablas leídas:** `tbl_t_partida`, `tbl_t_partida_estudiante`, `tbl_t_prueba`, `tbl_t_pregunta`, `tbl_m_estudiante_materia`, `tbl_m_usuario`

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Auth por headers del Gateway | El Gateway ya valida el JWT; el microservicio solo lee `X-User-Id/Role/Username` — sin dependencia de JWT propio |
| Socket.io en mismo puerto HTTP | Simplifica docker-compose y gateway; no requiere puerto adicional |
| Estado de sesión en Map (memoria) | Suficiente para instancia única; se pierde en restart pero el quiz se puede reiniciar |
| `requireProfesor` como middleware separado | Permite reusar en todas las rutas sin repetir lógica |
| Soft delete (`estado = false`) | Consistente con el resto del ecosistema eduLLM |
| Transacciones Prisma en creación de cuestionario | Garantiza atomicidad: si falla una pregunta, no queda prueba sin preguntas |
| `generateAccessCode` con reintentos (×10) | Evita colisiones en códigos de 6 chars alfanuméricos |

---

## Instrucciones para actualizar este doc
- Si cambia un flujo → actualiza la sección correspondiente.
- Si se añaden módulos → añade fila en la tabla de módulos.
- Si cambia la estrategia de auth → actualiza el diagrama y la sección de decisiones.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
