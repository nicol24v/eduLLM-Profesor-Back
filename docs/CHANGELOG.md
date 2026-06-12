[← Volver al índice](INDEX.md)

# Changelog — Profesor MS

Formato: `[vX.Y.Z] — YYYY-MM-DD`

---

## [v1.0.0] — 2026-06-11

### Añadido
- Estructura completa del microservicio (Node.js 20 + Express 4 + Prisma 5 + Socket.io 4)
- **HU9** — `GET /api/profesor/dashboard`: estadísticas principales del panel docente
- **HU10** — `POST /api/profesor/cuestionarios`: creación manual de cuestionarios con validación de preguntas y opciones
- **HU11** — `POST /api/profesor/cuestionarios/ia`: generación de cuestionarios con IA via ms-rag
- **HU12** — CRUD completo de cuestionarios (`GET`, `POST`, `GET/:id`, `PUT/:id`, `DELETE/:id`)
- **HU13** — Ciclo de vida de partidas: crear, iniciar, siguiente-pregunta, finalizar; eventos Socket.io en tiempo real
- **HU14** — `GET /api/profesor/partidas/:id/resultados` y `/ranking`: resultados y ranking completo
- **HU15** — `GET /api/profesor/partidas`: historial paginado de sesiones
- **HU16** — `GET /api/profesor/dashboard/graficas`: datos para barra horizontal, barra vertical y torta de distribución
- Materias asignadas: `GET /api/profesor/materias` y `GET /api/profesor/materias/:id`
- Autenticación por headers del Gateway (`X-User-Id`, `X-User-Role`, `X-Username`)
- Middleware `requireProfesor` para RBAC
- Sanitización global de inputs con `validator`
- Rate limiting: 200 req / 15 min
- Headers de seguridad con `helmet`
- Logger estructurado JSON con Winston
- Soft delete en cuestionarios y partidas
- Código de acceso único de 6 chars con reintentos
- `Dockerfile` + `docker-compose.yml` para entorno de desarrollo con nodemon
- `prisma/schema.prisma` con mapeo completo de la BD `edu_llm`
- Documentación completa en `/docs` (14 archivos)

---

## Instrucciones para actualizar este doc
- Añadir entrada al inicio con formato `[vX.Y.Z] — YYYY-MM-DD`.
- Categorías: `Añadido`, `Modificado`, `Corregido`, `Eliminado`, `Seguridad`.
- Un bullet por cambio relevante.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
