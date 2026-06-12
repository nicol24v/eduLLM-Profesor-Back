[← Volver al índice](INDEX.md)

# Mejoras y deuda técnica — Profesor MS

> **Nota para IA:** Esta sección documenta decisiones simplificadas tomadas en la versión inicial y las mejoras recomendadas para producción.

## Deuda técnica

### Estado de sesión en memoria (`sessionStates`)

**Problema:** El índice de pregunta actual (`preguntaIndex`) se guarda en un `Map` en memoria del proceso Node.js. Si el servidor se reinicia durante un quiz activo, el índice se pierde y el profesor debe llamar `/iniciar` de nuevo.

**Solución:** Migrar a **Redis** para estado distribuido y persistente:

```javascript
// En vez de sessionStates.set(id, { preguntaIndex })
await redis.hset(`partida:${id}`, 'preguntaIndex', 0);
```

**Prioridad:** Media — solo afecta si el servidor se reinicia durante un quiz activo.

---

### Generación de código de acceso

**Problema:** `generateAccessCode()` usa `Math.random()` — no es criptográficamente seguro.

**Solución:** Usar `crypto.randomBytes`:

```javascript
const crypto = require('crypto');
const generateAccessCode = () =>
  crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
```

**Prioridad:** Baja — el código solo vive mientras dura la sesión del quiz.

---

### Integración ms-rag sin contrato formal

**Problema:** El endpoint `POST /api/rag/generate-quiz` del ms-rag es asumido. Si el ms-rag usa una ruta diferente o un formato de payload/respuesta distinto, `createWithAI` fallará.

**Solución:** Alinear con el equipo de ms-rag y actualizar `cuestionario.service.js` + `INTEGRATIONS.md`.

**Prioridad:** Alta — necesario antes de habilitar HU11 en producción.

---

### Sin paginación en Socket.io

**Problema:** Al emitir `partida:pregunta`, se envía la pregunta completa a todos los sockets de la sala. Con muchos participantes, el servidor podría generar muchos eventos simultáneos.

**Solución:** Evaluar arquitectura de fanout con Redis Pub/Sub o usar Socket.io Adapter con Redis para escalar horizontalmente.

**Prioridad:** Baja en MVP, media en producción con >100 estudiantes simultáneos.

---

### Sin validación de `zod` en request bodies

**Problema:** Las validaciones actuales son manuales (ej. `if (!titulo) throw new AppError(...)`). No hay un schema formal que valide tipos y formatos.

**Solución:** Integrar `zod` (ya instalado en `package.json`) para validar schemas:

```javascript
const cuestionarioSchema = z.object({
  titulo: z.string().min(1).max(255),
  preguntas: z.array(preguntaSchema).min(1).max(20),
  ...
});
```

**Prioridad:** Media — mejora la calidad de los mensajes de error.

---

### Sin tests

**Problema:** No hay tests unitarios ni de integración.

**Solución sugerida:**
- Tests unitarios de servicios con Jest + Prisma mocked
- Tests de integración con Supertest + base de datos de prueba

**Prioridad:** Alta antes de pasar a producción.

---

## Roadmap sugerido

| Mejora | Prioridad | Esfuerzo estimado |
|--------|-----------|-------------------|
| Alinear contrato ms-rag (HU11) | Alta | 2h |
| Validación con Zod en todos los bodies | Media | 4h |
| Migrar sessionStates a Redis | Media | 6h |
| Tests unitarios de servicios | Alta | 1 día |
| Tests de integración | Alta | 2 días |
| `crypto.randomBytes` para código de acceso | Baja | 30min |
| Documentar con OpenAPI/Swagger | Media | 4h |
| Health check endpoint (`GET /health`) | Baja | 30min |
| Métricas Prometheus (`/actuator/prometheus`) | Baja | 2h |

---

## Instrucciones para actualizar este doc
- Al resolver un ítem de deuda → moverlo a `CHANGELOG.md` con la fecha de resolución.
- Al identificar nueva deuda → añadir con descripción, solución y prioridad.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
