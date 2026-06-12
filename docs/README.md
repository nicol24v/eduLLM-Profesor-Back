[← Volver al índice](INDEX.md)

# eduLLM · Profesor MS

Microservicio backend para el **módulo de profesores** de la plataforma educativa eduLLM. Expone una API REST que alimenta el dashboard del docente y gestiona cuestionarios, sesiones de quiz en tiempo real y visualización de resultados.

## Propósito

Implementa las **historias de usuario HU9–HU16**:

| HU | Funcionalidad |
|----|--------------|
| HU9 | Panel principal del docente (estadísticas, accesos rápidos) |
| HU10 | Creación manual de cuestionarios (5–20 preguntas, multimedia) |
| HU11 | Creación de cuestionarios con IA usando RAG sobre libro de Ciencias |
| HU12 | Gestión de cuestionarios (listar, editar, eliminar) |
| HU13 | Ejecución de quiz en tiempo real con Socket.io |
| HU14 | Visualización de resultados y ranking completo |
| HU15 | Historial de quizzes con detalle por partida |
| HU16 | Dashboard con gráficas (barras horizontal/vertical, torta) |

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL (schema `comun`, BD `edu_llm`) |
| Tiempo real | Socket.io 4 |
| Logger | Winston |
| Contenedor | Docker + docker-compose |

## Setup rápido

### Local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env (copiar desde .env.example y ajustar credenciales)
cp .env.example .env

# 3. Generar cliente Prisma
npx prisma generate

# 4. Iniciar en modo desarrollo
npm run dev
```

El servidor queda en `http://localhost:8085`.

### Docker

```bash
docker-compose up --build
```

> El contenedor se llama `rol-profesor-ms` y se conecta a la red `observability-net` (debe existir como red externa).

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgresql://admin:admin@localhost:5432/edu_llm?schema=comun` |
| `PORT` | Puerto del servidor | `8085` |
| `HOST` | Interfaz de escucha | `0.0.0.0` |
| `NODE_ENV` | Entorno (`development`/`production`) | `development` |
| `LOG_LEVEL` | Nivel de log Winston | `info` |
| `RATE_LIMIT_MAX` | Máximo de requests por ventana de 15 min | `200` |
| `RAG_SERVICE_URL` | URL base del microservicio RAG para generación con IA | `http://localhost:8002` |

## Estructura de carpetas

```
eduLLM-Profesor-BACK-dashboard/
├── server.js               ← Punto de entrada (HTTP + Socket.io)
├── src/
│   ├── app.js              ← Configuración Express
│   ├── config/             ← Prisma client, Winston logger
│   ├── utils/              ← AppError, catchAsync, codeGenerator
│   ├── middlewares/        ← auth, requireProfesor, errorHandler, sanitize
│   ├── socket/             ← Inicialización Socket.io y estado en memoria
│   ├── routes/v1/          ← dashboard, cuestionario, partida, materia
│   ├── controllers/        ← Capa HTTP (req → service → res)
│   ├── services/           ← Lógica de negocio
│   └── repositories/       ← Acceso a datos Prisma
├── prisma/
│   └── schema.prisma       ← Mapeo completo de edu_llm
├── Dockerfile
└── docker-compose.yml
```

---

## Instrucciones para actualizar este doc
- Si cambia el puerto o variables de entorno → actualiza la tabla de env vars.
- Si se añaden HU nuevas → actualiza la tabla de historias.
- Si cambia el stack → actualiza la tabla de tecnología.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
