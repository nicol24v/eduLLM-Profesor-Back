[← Volver al índice](INDEX.md)

# Servicios internos — Profesor MS

> **Nota para IA:** Cada servicio contiene la lógica de negocio. Los controladores no tienen lógica propia — solo llaman al servicio. Los repositorios solo tienen queries Prisma reutilizables.

## Patrón general

```
Controller → Service → Repository → Prisma
```

Todos los servicios usan `getProfesorOrFail(usuarioId)` como primera operación para obtener el `id_profesor` desde `tbl_m_profesor.usuario_id`.

---

## `dashboard.service.js`

**Responsabilidad:** Estadísticas del panel docente y datos para gráficas.

| Función | Descripción | Tablas leídas |
|---------|-------------|---------------|
| `getDashboardStats(usuarioId)` | Total estudiantes, cuestionarios, materias y partidas pendientes | `tbl_m_profesor`, `tbl_t_profesor_materia`, `tbl_m_estudiante_materia`, `tbl_t_prueba`, `tbl_t_partida` |
| `getGraficas(usuarioId)` | Datos para 3 gráficas: barra horizontal (por alumno), barra vertical (por quiz), torta (distribución de puntajes) | + `tbl_t_partida_estudiante`, `tbl_m_usuario` |

**Lógica de normalización de puntajes (gráfica torta):**  
`porcentaje = (puntaje_total / (total_preguntas × 1000)) × 100`  
Los 1000 pts por pregunta asumen un modelo Kahoot-like donde el puntaje máximo por respuesta es 1000 (decrece con el tiempo).

---

## `cuestionario.service.js`

**Responsabilidad:** Ciclo de vida completo de cuestionarios (HU10-HU12) e integración con IA (HU11).

| Función | Descripción |
|---------|-------------|
| `getAll(usuarioId, { page, limit, materia_id })` | Lista paginada de cuestionarios del profesor |
| `getById(usuarioId, pruebaId)` | Detalle con preguntas y opciones, verificando ownership |
| `create(usuarioId, body)` | Crea prueba + preguntas + opciones en **una sola transacción** |
| `createWithAI(usuarioId, body)` | Llama ms-rag y luego delega a `create()` |
| `update(usuarioId, pruebaId, body)` | Actualiza prueba; permite editar preguntas existentes (por `id_pregunta`) y agregar nuevas |
| `remove(usuarioId, pruebaId)` | Soft delete (`estado = false`) |

**Helper privado `assertOwnership(pruebaId, profesor)`:** Verifica que la prueba pertenece al profesor antes de leer/modificar.

**Validaciones en `create()`:**
- `profesor_materia_id` debe existir y pertenecer al profesor
- 1–20 preguntas
- ≥2 opciones por pregunta
- Exactamente 1 opción con `es_correcta: true`

---

## `partida.service.js`

**Responsabilidad:** Ciclo de vida de sesiones de quiz y control en tiempo real.

| Función | Descripción |
|---------|-------------|
| `getHistory(usuarioId, opts)` | Historial paginado de partidas |
| `getById(usuarioId, partidaId)` | Detalle de la partida con preguntas de la prueba |
| `create(usuarioId, body)` | Crea partida con código único de 6 chars (hasta 10 reintentos) |
| `iniciar(usuarioId, partidaId)` | `esperando → en_curso`, emite `partida:iniciada` Socket.io |
| `siguientePregunta(usuarioId, partidaId)` | Incrementa índice en `sessionStates`, emite `partida:pregunta` sin `es_correcta` |
| `finalizar(usuarioId, partidaId)` | Cualquier estado → `finalizada`, limpia `sessionStates`, emite `partida:finalizada` |
| `getResultados(usuarioId, partidaId)` | Delega a `partidaRepository.findResultados()` |
| `getRanking(usuarioId, partidaId)` | Ranking ordenado por `puntaje_total DESC` |

**Estado en memoria (`sessionStates` Map):**
```javascript
Map {
  partida_id → { preguntaIndex: number, totalPreguntas: number }
}
```
Se inicializa en `create()` y `iniciar()`, se elimina en `finalizar()`. No persiste en BD.

**Helper privado `assertPartidaOwnership(partidaId, profesor)`:** Verifica que la partida pertenece a una prueba del profesor.

---

## `materia.service.js`

**Responsabilidad:** Materias asignadas al profesor con estadísticas y lista de estudiantes.

| Función | Descripción |
|---------|-------------|
| `getMaterias(usuarioId)` | Lista de asignaciones con totales de estudiantes y cuestionarios |
| `getMateriaById(usuarioId, profesorMateriaId)` | Detalle de una asignación con lista completa de estudiantes matriculados |

---

## Socket.io — `socket/socket.js`

**No es un servicio HTTP** sino un módulo de eventos en tiempo real.

**Inicialización:** `initSocket(httpServer)` — llamado desde `server.js` después de crear el servidor HTTP.

**Módulo singleton:**
- `getIO()` → retorna la instancia de Socket.io para que los servicios puedan emitir eventos
- `getSessionStates()` → retorna el Map de estados de partidas activas

**Sala:** Cada partida tiene su propia sala `partida:{id}`. Profesor y estudiantes se unen a ella.

---

## Instrucciones para actualizar este doc
- Si se añade un método de servicio → añade fila en la tabla correspondiente.
- Si cambia la lógica de normalización de puntajes → actualiza la sección de dashboard.
- Si se añade persistencia Redis para `sessionStates` → actualizar esta sección.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
