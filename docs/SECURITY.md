[← Volver al índice](INDEX.md)

# Seguridad — Profesor MS

> **Nota para IA:** Este microservicio soporta dos modos de autenticación: (1) headers del Gateway (`X-User-*`) en producción, y (2) decodificación JWT directa como fallback para desarrollo.

## Modelo de seguridad

```
Modo Gateway (producción):
Cliente → Gateway (valida JWT, inyecta headers) → Profesor MS (lee headers, verifica rol)

Modo Directo (desarrollo):
Cliente → Profesor MS (decodifica JWT de Authorization/cookie, verifica rol)
```

El microservicio **nunca** debería ser accesible directamente desde internet en producción.

---

## Autenticación

**Mecanismo primario:** Headers HTTP inyectados por el Gateway tras validar el JWT.

| Header | Tipo | Descripción |
|--------|------|-------------|
| `X-User-Id` | `string` (número) | ID del usuario autenticado |
| `X-User-Role` | `string` | Rol del usuario (`PROFESOR`, `ESTUDIANTE`, `ADMINISTRADOR`) |
| `X-Username` | `string` | Username del usuario |

**Mecanismo fallback (desarrollo):** Si los headers `X-User-*` no están presentes, el middleware decodifica el JWT desde:
- `Authorization: Bearer <token>` (prioridad)
- Cookie `jwtToken`

La decodificación extrae los claims del payload (base64) **sin verificar la firma** — la validación criptográfica corre por cuenta del Gateway en producción.

**`auth.middleware.js`:**
1. Primero busca headers `X-User-Id`, `X-User-Role`, `X-Username`
2. Si no están presentes, busca JWT en `Authorization: Bearer` o cookie `jwtToken`
3. Decodifica el payload del JWT y extrae `idUsuario` → `req.user.id_usuario`, `rol` → `req.user.rol`
4. Si ningún método funciona, `req.user` queda `undefined` (la ruta protegida lo rechazará con 401)

**Spoofing prevention:** Los headers `X-User-*` deben ser eliminados por el Gateway antes de reenviar la petición. En el modo directo, el JWT firmado impide la suplantación (aunque el microservicio no verifica la firma, el Gateway sí lo haría en producción).

---

## Autorización (RBAC)

**`requireProfesor.js`:** Middleware que aplica en todas las rutas. Verifica:

```javascript
if (!req.user)          → 401 No autenticado
if (req.user.rol !== 'PROFESOR') → 403 Acceso denegado
```

**Normalización de roles:** El middleware acepta tanto `PROFESOR` como `ROLE_PROFESOR` (con prefijo `ROLE_`) para compatibilidad con distintos formatos de JWT.

```javascript
const rol = req.user.rol.replace(/^ROLE_/, '');
if (rol !== 'PROFESOR') throw new AppError('Acceso denegado', 403);
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
- Errores Prisma:
  - `P2025` (not found) → `404`
  - `P2002` (unique constraint) → `409`
  - `P2003` (foreign key) → `409`
  - `P2014` (required relation) → `409`
  - `P2016` (query interpretation) → `400`
- `ZodError` / `express-validator` → `400` con mensaje genérico `"Error de validación"` (detalles solo en logs)
- Errores de `express-validator` → `400`
- Cualquier otro error → `500` con mensaje genérico `"Internal Server Error"` (sin stack trace al cliente)
- Stack trace solo se loguea internamente vía Winston con contexto de usuario y ruta

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
- Si cambia el mecanismo de autenticación (ej. más orígenes de JWT) → actualizar el diagrama y la tabla.

*Última revisión: 2026-06-16 · refactor OOP + JWT fallback*

[← Volver al índice](INDEX.md)
