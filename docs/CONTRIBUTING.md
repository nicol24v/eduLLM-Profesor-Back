[← Volver al índice](INDEX.md)

# Guía de contribución — Profesor MS

> **Nota para IA:** Sigue este patrón al añadir cualquier funcionalidad. El proyecto usa el patrón Controller → Service (class) → Mapper (static) → Repository (class).

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

// GET — profesor_id desde query param
const listar = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  const data = await miService.listar(parseInt(profesor_id, 10));
  res.json({ success: true, data });
});

// POST — profesor_id desde body
const crear = catchAsync(async (req, res) => {
  const { profesor_id } = req.body;
  await miService.crear(parseInt(profesor_id, 10), req.body);
  res.status(201).json({ success: true, message: 'Recurso creado' });
});

module.exports = { listar, crear };
```

**Reglas:**
- Siempre usar `catchAsync` — nunca `try/catch` en el controller
- Solo extraer parámetros y delegar al service
- `profesor_id` siempre del request: body (POST/PUT) o query (GET/DELETE)
- POST/PUT de creación/actualización: `{ success: true, message }` (sin `data`)
- GET: `{ success: true, data }`
- Errores: solo `{ success: false, message }` genérico (detalles van a logs)
- `201` para creación, `200` para todo lo demás

---

### 3. Crear el service

Archivo: `src/services/[modulo].service.js`

```javascript
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const MiMapper = require('../mappers/mi.mapper');

class MiService {
  #validateProfesorExists = async (profesorId) => {
    const profesor = await prisma.tbl_m_profesor.findUnique({
      where: { id_profesor: profesorId, estado: true },
    });
    if (!profesor) throw new AppError('Profesor no encontrado', 404);
    return profesor;
  };

  crear = async (profesorId, body) => {
    const profesor = await this.#validateProfesorExists(profesorId);
    const result = await prisma.tbl_mi_tabla.findMany({ ... });
    return MiMapper.toResponse(result);
  };

  listar = async (profesorId) => {
    const profesor = await this.#validateProfesorExists(profesorId);
    const result = await prisma.tbl_mi_tabla.findMany({ ... });
    return MiMapper.toResponse(result);
  };
}

module.exports = new MiService();
```

**Reglas:**
- Clase con métodos públicos y privados (`#`)
- Exportar instancia singleton: `module.exports = new MiService()`
- Todos los métodos reciben `profesorId` — lookup por `id_profesor`
- `profesor_id` viene del request: body (POST/PUT) o query (GET/DELETE)
- Lanzar `AppError(mensaje, statusCode)` para errores operacionales
- Usar `prisma.$transaction()` cuando se escriben múltiples tablas
- Verificar ownership antes de leer/modificar datos de otros usuarios
- Transformar resultado con **Mapper** antes de devolverlo al controller

---

### 4. Crear el repository (si hay queries reutilizables)

Archivo: `src/repositories/[modulo].repository.js`

```javascript
const prisma = require('../config/prisma');

class MiRepository {
  findByIdConDetalle = async (id) => {
    return prisma.tbl_mi_tabla.findFirst({
      where: { id_mi_tabla: id, estado: true },
      include: { ... },
    });
  };
}

module.exports = new MiRepository();
```

Los repositories solo contienen **queries Prisma** — sin lógica de negocio. Se exportan como instancia singleton.

---

### 4b. Crear el mapper (si hay transformaciones DB→API)

Archivo: `src/mappers/[modulo].mapper.js`

```javascript
class MiMapper {
  static toResponse(data) {
    return {
      id: data.id_mi_tabla,
      nombre: data.nombre,
      // renombrar, filtrar, transformar
    };
  }

  static toListResponse(items) {
    return items.map(MiMapper.toResponse);
  }
}

module.exports = { MiMapper };
```

Los mappers:
- Contienen solo **métodos estáticos** — sin estado
- Transforman el formato Prisma (snake_case) a API (camelCase si aplica)
- Filtran campos sensibles (ej. `es_correcta` en opciones de preguntas)
- Se usan en el service antes de devolver datos al controller

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

> **Importante:** El `errorHandler` devuelve siempre `{ success: false, message }` genérico. Los detalles del error solo se escriben en logs. No expongas `code`, `errors` ni stack traces en la respuesta.

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
