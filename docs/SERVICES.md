[← Volver al índice](INDEX.md)

# Servicios internos — Profesor MS

> **Nota para IA:** Cada servicio es una **clase** con métodos públicos y privados (`#`). Los controladores instancian el servicio vía su singleton exportado. Los repositorios también son clases. Los **mappers** transforman datos DB→API.

## Patrón general

```
Controller → Service (class) → Mapper (static) → Repository (class) → Prisma
```

El Gateway inyecta `profesor_id` en query params con el valor de `id_usuario`. Los servicios deben resolver el `id_profesor` real mediante `tbl_m_profesor.usuario_id`.  
Para eso, los servicios disponen de dos métodos privados:

| Método | Lookup | Uso |
|--------|--------|-----|
| `#getProfesorOrFail(usuarioId)` | `tbl_m_profesor` por `usuario_id` | POST/PUT y dashboard |
| `#validateProfesorExists(profesorId)` | `tbl_m_profesor` por `id_profesor` | GET/DELETE (legado) |

> ⚠️ **Importante:** El valor `profesor_id` que llega en query/body es `id_usuario`, no `id_profesor`. Siempre que sea posible, usar `#getProfesorOrFail(usuarioId)` para resolver correctamente.

---

## `DashboardService` — `dashboard.service.js`

**Responsabilidad:** Estadísticas del panel docente y datos para gráficas.

| Método | Descripción | Tablas leídas |
|---------|-------------|---------------|
| `getDashboardStats(usuarioId)` | Total estudiantes, cuestionarios, materias y partidas pendientes | `tbl_m_profesor`, `tbl_t_profesor_materia`, `tbl_m_estudiante_materia`, `tbl_t_prueba`, `tbl_t_partida` |
| `getGraficas(usuarioId)` | Datos para 3 gráficas: barra horizontal (por alumno), barra vertical (por quiz), torta (distribución de puntajes) | + `tbl_t_partida_estudiante`, `tbl_m_usuario` |

**Métodos privados:**
- `#getProfesorOrFail(usuarioId)` — busca `tbl_m_profesor` por `usuario_id` y resuelve el `id_profesor` real

**Mapper:** `DashboardMapper` — transforma resultados agregados en formato para gráficas.

**Lógica de normalización de puntajes (gráfica torta):**  
`porcentaje = (puntaje_total / (total_preguntas × 1000)) × 100`  
Los 1000 pts por pregunta asumen un modelo Kahoot-like donde el puntaje máximo por respuesta es 1000 (decrece con el tiempo).

---

## `CuestionarioService` — `cuestionario.service.js`

**Responsabilidad:** Ciclo de vida completo de cuestionarios (HU10-HU12) e integración con IA (HU11).

| Método | Tipo | Descripción |
|---------|------|-------------|
| `getAll(profesorId, { page, limit, materia_id })` | GET | Lista paginada de cuestionarios del profesor |
| `getById(profesorId, pruebaId)` | GET | Detalle con preguntas y opciones, verificando ownership |
| `create(usuarioId, body)` | POST | Crea prueba + preguntas + opciones en **una sola transacción**; soporta `esIA: true` para generación IA |
| `update(usuarioId, pruebaId, body)` | PUT | Actualiza prueba; permite editar preguntas existentes (por `id_pregunta`) y agregar nuevas |
| `remove(profesorId, pruebaId)` | DELETE | Soft delete (`estado = false`) |

**Métodos privados:**
- `#getProfesorOrFail(usuarioId)` — obtiene `tbl_m_profesor` por `usuario_id` (POST/PUT)
- `#validateProfesorExists(profesorId)` — valida `tbl_m_profesor` por `id_profesor` (GET/DELETE)
- `#assertOwnership(pruebaId, profesor)` — verifica que la prueba pertenece al profesor
- `#findActiveProfesorMateria(profesorId, materiaId)` — busca asignación activa por `materia_id` + periodo lectivo activo
- `#generateWithAI(tema, cantidadPreguntas)` — llama a ms-rag y parsea respuesta

**Mapper:** `CuestionarioMapper` — transforma resultados Prisma en API response (filtra `es_correcta`, renombra campos).

**Validaciones en `create()`:**
- `materia_id` debe existir y tener una asignación activa para el profesor
- 1–20 preguntas
- ≥2 opciones por pregunta
- Exactamente 1 opción con `es_correcta: true`

---

## `PartidaService` — `partida.service.js`

**Responsabilidad:** Ciclo de vida de sesiones de quiz y control en tiempo real.

| Método | Tipo | Descripción |
|---------|------|-------------|
| `getHistory(profesorId, opts)` | GET | Historial paginado de partidas |
| `getById(profesorId, partidaId)` | GET | Detalle de la partida con preguntas de la prueba |
| `create(usuarioId, body)` | POST | Crea partida con código único de 6 chars (hasta 10 reintentos) |
| `getResultados(profesorId, partidaId)` | GET | Delega a `partidaRepository.findResultados()` |
| `getRanking(profesorId, partidaId)` | GET | Ranking ordenado por `puntaje_total DESC` |

**Métodos privados:**
- `#getProfesorOrFail(usuarioId)` — obtiene `tbl_m_profesor` por `usuario_id` (POST)
- `#validateProfesorExists(profesorId)` — valida `tbl_m_profesor` por `id_profesor` (GET)
- `#assertPartidaOwnership(partidaId, profesor)` — verifica que la partida pertenece a una prueba del profesor

**Mapper:** `PartidaMapper` — transforma partidas, resultados y ranking para API.

**Estado en memoria (`sessionStates` Map):**
```javascript
Map {
  partida_id → { preguntaIndex: number, totalPreguntas: number }
}
```
Se inicializa en `create()` y `iniciar()`, se elimina en `finalizar()`. No persiste en BD.

---

## `MateriaService` — `materia.service.js`

**Responsabilidad:** Materias asignadas al profesor con estadísticas y lista de estudiantes.

| Método | Tipo | Descripción |
|---------|------|-------------|
| `getMaterias(profesorId)` | GET | Lista de asignaciones con totales de estudiantes y cuestionarios |
| `getMateriaById(profesorId, materiaId)` | GET | Detalle de una asignación con lista completa de estudiantes matriculados |

**Mapper:** `MateriaMapper` — transforma asignaciones y estudiantes para API.

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
