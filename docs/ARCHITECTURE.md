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
    authMiddleware (X-User-* headers o JWT fallback, resuelve usuario no profesor)
    globalSanitizer
    │
    ▼
[ Routes /api/profesor/* ]
    requireProfesor (verifica rol, normaliza ROLE_ prefijo)
    │
    ▼
[ Controller ]
    Extrae params/body · llama al Service · devuelve JSON
    │
    ▼
[ Service (class) ]
    Lógica de negocio · validaciones · transacciones Prisma
    Métodos privados (#getProfesorOrFail, #validateProfesorExists, #assertOwnership, #findActiveProfesorMateria)
    │
    ▼
[ Mapper ]
    Transformación DB→API (static methods)
    │
    ▼
[ Repository (class) ]
    Queries Prisma reutilizables (findByIdWithPreguntas, findResultados…)
    │
    ▼
[ Prisma ORM ]  ──►  PostgreSQL (edu_llm, schema comun)
```

## Módulos

| Módulo | Archivos | Responsabilidad |
|--------|----------|-----------------|
| `dashboard` | `dashboard.controller.js`, `dashboard.service.js`, `dashboard.mapper.js` | Estadísticas HU9, datos de gráficas HU16 |
| `cuestionario` | `cuestionario.controller.js`, `cuestionario.service.js`, `cuestionario.repository.js`, `cuestionario.mapper.js` | CRUD cuestionarios HU10-HU12, generación IA HU11 |
| `partida` | `partida.controller.js`, `partida.service.js`, `partida.repository.js`, `partida.mapper.js` | Sesiones de quiz HU13, resultados HU14, historial HU15 |
| `materia` | `materia.controller.js`, `materia.service.js`, `materia.repository.js`, `materia.mapper.js` | Materias asignadas al profesor |
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
  "materia_id": 3,
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
   - Busca `tbl_t_profesor_materia` activa por `profesor_id + materia_id + periodo_lectivo_activo`
   - Valida: `titulo` requerido, 1–20 preguntas, cada pregunta con ≥2 opciones y exactamente 1 correcta
2. Abre **transacción Prisma**:
   - Crea `tbl_t_prueba`
   - Por cada pregunta → crea `tbl_t_pregunta`
   - Por cada opción → crea `tbl_t_opcion`
3. Llama a `cuestionarioRepository.findByIdWithPreguntas(id)` y devuelve el cuestionario completo

**Tablas escritas:** `tbl_t_prueba`, `tbl_t_pregunta`, `tbl_t_opcion`

---

### Flujo HU11 — Crear cuestionario con IA (integrado en POST /cuestionarios)

El endpoint único `POST /api/profesor/cuestionarios` acepta un flag `esIA`. El body es idéntico al manual, solo cambia el flag:

```json
{ "materia_id": 3, "titulo": "Sistema solar", "esIA": true, "preguntas": [...] }
```

1. Las preguntas llegan ya generadas desde el frontend
2. El backend guarda `descripcion = "IA"` en la prueba para identificar su origen

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
| Auth resuelve `usuario_id`, no `profesor_id` | POST/PUT usan `req.user.id_usuario` para buscar el profesor por `usuario_id`; GET/DELETE reciben `profesor_id` explícito en query param |
| `profesor_id` en query para GET | Los endpoints de consulta requieren `profesor_id` para identificar qué profesor; los de creación lo resuelven del auth |
| Servicios y repositorios como clases (OOP) | Consistente con el patrón del Admin Backend; permite métodos privados `#` y mejor encapsulación |
| Mappers como capa independiente | Separa transformación DB→API de la lógica de negocio; static methods sin estado |
| `materia_id` en lugar de `profesor_materia_id` | El frontend no necesita conocer la asignación interna; el backend la resuelve automáticamente |
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
