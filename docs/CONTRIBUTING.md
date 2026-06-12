[← Volver al índice](INDEX.md)

# Guía de contribución — Profesor MS

> **Nota para IA:** Sigue este patrón al añadir cualquier funcionalidad. El proyecto usa el patrón Controller → Service → Repository.

## Añadir un nuevo endpoint

### 1. Crear o extender la ruta

Archivo: `src/routes/v1/[modulo].routes.js`

```javascript
const requireProfesor = require('../../middlewares/requireProfesor');
const miController = require('../../controllers/mi.controller');

router.get('/nuevo-endpoint', requireProfesor, miController.metodo);
```

Registrar en `src/routes/index.js` si es un módulo nuevo:

```javascript
const miRoutes = require('./v1/mi.routes');
router.use('/mi-recurso', miRoutes);
```

---

### 2. Crear el controller

Archivo: `src/controllers/[modulo].controller.js`

```javascript
const catchAsync = require('../utils/catchAsync');
const miService = require('../services/mi.service');

const metodo = catchAsync(async (req, res) => {
  const data = await miService.hacerAlgo(req.user.id_usuario, req.params.id);
  res.json({ success: true, data });
});

module.exports = { metodo };
```

**Reglas:**
- Siempre usar `catchAsync` — nunca `try/catch` en el controller
- Solo extraer parámetros y delegar al service
- Respuesta siempre con `{ success: true, data }` o `{ success: true, message }`
- `201` para creación, `200` para todo lo demás

---

### 3. Crear el service

Archivo: `src/services/[modulo].service.js`

```javascript
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const hacerAlgo = async (usuarioId, id) => {
  // 1. Obtener el profesor
  const profesor = await prisma.tbl_m_profesor.findUnique({
    where: { usuario_id: usuarioId, estado: true },
  });
  if (!profesor) throw new AppError('Profesor no encontrado', 404);

  // 2. Lógica de negocio
  // ...

  return resultado;
};

module.exports = { hacerAlgo };
```

**Reglas:**
- Primera operación: siempre obtener el registro `tbl_m_profesor` del usuario
- Lanzar `AppError(mensaje, statusCode)` para errores operacionales
- Usar `prisma.$transaction()` cuando se escriben múltiples tablas
- Verificar ownership antes de leer/modificar datos de otros usuarios

---

### 4. Crear el repository (si hay queries reutilizables)

Archivo: `src/repositories/[modulo].repository.js`

```javascript
const prisma = require('../config/prisma');

const findByIdConDetalle = async (id) => {
  return prisma.tbl_mi_tabla.findFirst({
    where: { id_mi_tabla: id, estado: true },
    include: { ... },
  });
};

module.exports = { findByIdConDetalle };
```

Los repositories solo contienen **queries Prisma** — sin lógica de negocio.

---

### 5. Actualizar documentación

| Cambio | Archivo a actualizar |
|--------|---------------------|
| Nuevo endpoint | [API.md](API.md) |
| Nuevo flujo de negocio | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Nueva tabla o columna | [DATABASE.md](DATABASE.md) |
| Nueva integración externa | [INTEGRATIONS.md](INTEGRATIONS.md) |
| Cambio de seguridad | [SECURITY.md](SECURITY.md) |
| Nuevo servicio interno | [SERVICES.md](SERVICES.md) |
| Cambio relevante | [CHANGELOG.md](CHANGELOG.md) |

---

## Añadir ruta pública (sin auth)

Si un endpoint no requiere autenticación, simplemente omite el middleware `requireProfesor`:

```javascript
router.get('/publico', miController.metodo);
```

Y documenta en [SECURITY.md](SECURITY.md) el motivo.

---

## Manejo de errores

| Situación | Qué hacer |
|-----------|-----------|
| Recurso no encontrado | `throw new AppError('Mensaje', 404)` |
| Validación fallida | `throw new AppError('Mensaje', 400)` |
| Sin permisos | `throw new AppError('Mensaje', 403)` |
| Servicio externo caído | `throw new AppError('Mensaje', 503)` |
| Error inesperado | Dejar propagar (el `errorHandler` lo captura como 500) |

---

## Estilo de código

- `const` por defecto, `let` solo si la variable cambia
- `async/await` siempre (no callbacks ni `.then`)
- Sin comentarios obvios; comentar solo la lógica no evidente
- Nombres en español para variables de dominio (`profesor`, `partida`, `prueba`)
- Nombres en inglés para utilidades genéricas (`catchAsync`, `AppError`)

---

## Instrucciones para actualizar este doc
- Si cambia el patrón de arquitectura → actualizar los ejemplos de código.
- Si se añaden nuevos middlewares comunes → añadir sección.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
