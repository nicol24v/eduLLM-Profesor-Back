[← Volver al índice](INDEX.md)

# Dependencias — Profesor MS

> **Nota para IA:** Todas las dependencias están en `package.json`. Versiones exactas en `package-lock.json`.

## Dependencias de producción

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `@prisma/client` | ^5.8.0 | Cliente ORM generado para interactuar con PostgreSQL. Importado desde `src/config/prisma.js`. |
| `cookie-parser` | ^1.4.7 | Parseo de cookies HTTP. Requerido aunque la auth la gestione el Gateway. |
| `cors` | ^2.8.5 | Instalado por compatibilidad con el ecosistema — el CORS real lo gestiona el Gateway. |
| `dotenv` | ^16.3.1 | Carga variables de entorno desde `.env` en `server.js`. |
| `express` | ^4.18.2 | Framework HTTP principal. Gestiona rutas, middlewares y respuestas. |
| `express-rate-limit` | ^7.1.5 | Rate limiting global (15 min / 200 req). Configurado en `src/app.js`. |
| `express-validator` | ^7.3.2 | Sanitizadores por ruta (`sanitizeCuestionario`, `sanitizePregunta`). |
| `helmet` | ^7.1.0 | Headers de seguridad HTTP (`X-Content-Type-Options`, `X-Frame-Options`, etc.). |
| `socket.io` | ^4.7.4 | Servidor WebSocket para eventos en tiempo real del quiz (HU13). |
| `validator` | ^13.15.35 | Funciones de sanitización en `globalSanitizer` (`trim`, `escape`, `normalizeEmail`). |
| `winston` | ^3.11.0 | Logger estructurado JSON. Escribe a consola + archivos `logs/error.log` y `logs/combined.log`. |
| `zod` | ^3.22.4 | Librería de validación de schemas. **Instalada pero pendiente de uso** — ver [IMPROVEMENTS.md](IMPROVEMENTS.md). |

## Dependencias de desarrollo

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `nodemon` | ^3.0.2 | Reinicio automático del servidor en desarrollo al detectar cambios de archivos. |
| `prisma` | ^5.8.0 | CLI de Prisma: `prisma generate`, `prisma db pull`. Solo en desarrollo/CI. |

## Árbol de dependencias crítico

```
express
  └── express-rate-limit  (middleware global)
  └── helmet              (middleware global)
  └── express-validator   (middleware por ruta)

socket.io
  └── Usa el mismo http.Server que Express

@prisma/client
  └── Generado por `prisma generate` desde schema.prisma
  └── Requiere openssl (instalado en Dockerfile)

winston
  └── logs/ directorio (creado automáticamente)
```

## Notas de versión

- **Node.js 20** requerido (usa `fetch` nativo para llamadas al ms-rag)
- **`@prisma/client` v5** requiere `openssl` en Alpine Linux — por eso el Dockerfile incluye `apk add openssl`
- **`socket.io` v4** es compatible con `socket.io-client` v4 en el frontend

---

## Instrucciones para actualizar este doc
- Al actualizar una dependencia → actualiza la versión en la tabla.
- Al añadir una dependencia nueva → añade su fila explicando el propósito.
- Al eliminar una dependencia → quítala de la tabla y del `package.json`.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
