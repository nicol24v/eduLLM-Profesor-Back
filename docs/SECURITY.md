[← Volver al índice](INDEX.md)

# Seguridad — Profesor MS

> **Nota para IA:** Este microservicio delega la autenticación al Gateway. No valida JWT ni gestiona tokens. Su responsabilidad de seguridad es leer correctamente los headers del Gateway y verificar el rol.

## Modelo de seguridad

```
Cliente → Gateway (valida JWT) → Profesor MS (lee headers, verifica rol PROFESOR)
```

El microservicio **nunca** debería ser accesible directamente desde internet — solo desde el Gateway en la red interna Docker.

---

## Autenticación

**Mecanismo:** Headers HTTP inyectados por el Gateway tras validar el JWT.

| Header | Tipo | Descripción |
|--------|------|-------------|
| `X-User-Id` | `string` (número) | ID del usuario autenticado |
| `X-User-Role` | `string` | Rol del usuario (`PROFESOR`, `ESTUDIANTE`, `ADMINISTRADOR`) |
| `X-Username` | `string` | Username del usuario |

**`auth.middleware.js`:** Lee los headers y popula `req.user`. Si los headers no están presentes, `req.user` queda `undefined` (no falla — la ruta protegida lo rechazará).

**Spoofing prevention:** Los headers `X-User-*` deben ser eliminados por el Gateway antes de reenviar la petición, para que un cliente malicioso no pueda inyectarlos. Esto se configura en el Gateway, no aquí.

---

## Autorización (RBAC)

**`requireProfesor.js`:** Middleware que aplica en todas las rutas. Verifica:

```javascript
if (!req.user)          → 401 No autenticado
if (req.user.rol !== 'PROFESOR') → 403 Acceso denegado
```

**Ownership checks en servicios:**
- `assertOwnership()` en `cuestionario.service.js` — verifica que la prueba pertenece al profesor autenticado
- `assertPartidaOwnership()` en `partida.service.js` — verifica que la partida pertenece al profesor
- `getMateriaById()` en `materia.service.js` — verifica que la asignación es del profesor

Un profesor no puede leer/modificar datos de otro profesor aunque adivine el ID.

---

## Rate Limiting

Configurado con `express-rate-limit`:

| Parámetro | Valor |
|-----------|-------|
| Ventana | 15 minutos |
| Máximo de requests | `RATE_LIMIT_MAX` (default: 200) |
| Scope | Global (todas las rutas) |

Respuesta cuando se excede: `429 Too Many Requests`.

---

## Sanitización de entrada

**`globalSanitizer` middleware:** Se aplica a `req.body`, `req.query` y `req.params` en todas las rutas.

- Strings: `validator.trim()` + `validator.escape()` (escapa HTML entities: `<`, `>`, `&`, `"`, `'`)
- Arrays y objetos: aplicado recursivamente
- Tipos no-string (números, booleanos): sin modificar

> Los textos de preguntas y opciones almacenados en BD pueden contener HTML entities. El frontend debe decodificarlos al mostrarlos.

**Sanitizadores de ruta** (`sanitizeCuestionario`, `sanitizePregunta`): aplicados en las rutas de creación y actualización de cuestionarios.

---

## Headers de seguridad HTTP

Gestionados por `helmet`:

| Header | Valor |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Resource-Policy` | `cross-origin` (para compatibilidad con archivos estáticos) |

> CORS, HSTS y CSP se gestionan centralizadamente en el Gateway.

---

## Manejo seguro de errores

**`errorHandler.js`:** Intercepta todos los errores antes de responder al cliente.

- `AppError` (operacionales) → devuelve `{ success: false, message }` con el código HTTP específico
- Errores Prisma `P2025` (not found) → `404`
- Errores Prisma `P2002` (unique constraint) → `409`
- Cualquier otro error → `500` con mensaje genérico `"Internal Server Error"` (sin stack trace al cliente)
- Stack trace solo se loguea internamente vía Winston

---

## Variables sensibles

| Variable | Sensibilidad | Almacenamiento |
|----------|-------------|----------------|
| `DATABASE_URL` | Alta (credenciales BD) | `.env` (no commitear) |
| `RAG_SERVICE_URL` | Baja | `.env` |

El archivo `.env` está en `.gitignore`. Usar `.env.example` como plantilla.

---

## Instrucciones para actualizar este doc
- Si se añade validación JWT propia → actualizar la sección de autenticación.
- Si se añaden nuevas rutas públicas (sin `requireProfesor`) → documentarlas aquí.
- Si cambia el algoritmo de sanitización → actualizar la sección correspondiente.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
