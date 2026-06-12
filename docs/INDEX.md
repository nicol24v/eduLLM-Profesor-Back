# eduLLM · Profesor MS — Índice de Documentación

> **Nota para IA:** Este es el punto de entrada principal. Cada sección enlaza al archivo detallado correspondiente. Leer este archivo primero antes de explorar el repositorio.

## Archivos de documentación

| Archivo | Descripción |
|---------|-------------|
| [README.md](README.md) | Vista general del proyecto, propósito y setup rápido |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Diagrama de módulos, flujos detallados, decisiones técnicas |
| [API.md](API.md) | Todos los endpoints REST y eventos Socket.io con ejemplos |
| [DATABASE.md](DATABASE.md) | Esquema completo de `edu_llm`, tablas, columnas, relaciones |
| [SERVICES.md](SERVICES.md) | Servicios internos: dashboard, cuestionario, partida, materia |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Gateway, ms-rag, Socket.io, Observabilidad |
| [SECURITY.md](SECURITY.md) | Auth por headers de Gateway, RBAC, rate limiting, sanitización |
| [VIEWS.md](VIEWS.md) | No aplica — microservicio puro (sin UI) |
| [IMPROVEMENTS.md](IMPROVEMENTS.md) | Deuda técnica, mejoras sugeridas, roadmap |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Cómo añadir rutas, servicios y repositorios |
| [GLOSSARY.md](GLOSSARY.md) | Términos del dominio educativo |
| [DEPENDENCIES.md](DEPENDENCIES.md) | Librerías externas y para qué se usan |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios |

## Accesos rápidos

- **Arrancar en local** → [README.md#setup](README.md#setup-rápido)
- **Ver todos los endpoints** → [API.md](API.md)
- **Entender la base de datos** → [DATABASE.md](DATABASE.md)
- **Añadir un nuevo endpoint** → [CONTRIBUTING.md](CONTRIBUTING.md)
- **Flujo de un quiz en tiempo real** → [ARCHITECTURE.md#flujo-hu13](ARCHITECTURE.md#flujo-hu13-ejecución-de-quiz-en-tiempo-real)

---
*Última revisión: 2026-06-11 · commit inicial*
