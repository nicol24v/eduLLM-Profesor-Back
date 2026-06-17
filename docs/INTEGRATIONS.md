[← Volver al índice](INDEX.md)

# Integraciones — Profesor MS

> **Nota para IA:** En producción, la autenticación y el enrutamiento se delegan al Gateway. Sin embargo, el microservicio incluye un **fallback JWT** para desarrollo directo (Bruno, tests) sin necesidad del Gateway.

## Gateway (Spring Cloud Gateway — Puerto 8085)

**Función:** Punto de entrada único del ecosistema. Valida el JWT, inyecta headers de contexto y redirige las peticiones al microservicio correspondiente.

**Headers inyectados por el Gateway:**

| Header | Descripción | Ejemplo |
|--------|-------------|---------|
| `X-User-Id` | ID del usuario autenticado | `42` |
| `X-User-Role` | Rol del usuario (nombre en BD) | `PROFESOR` |
| `X-Username` | Username del usuario | `maria.perez` |

**Configuración necesaria en el Gateway** (`application.yml`):

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: profesor-ms
          uri: http://rol-profesor-ms:8085
          predicates:
            - Path=/api/profesor/**
      default-filters:
        - RemoveRequestHeader=X-User-Id
        - RemoveRequestHeader=X-User-Role
        - RemoveRequestHeader=X-Username
        - RemoveRequestHeader=X-User-Name
```

> El nombre `rol-profesor-ms` debe coincidir con `container_name` en `docker-compose.yml`.

**CORS:** El Gateway gestiona CORS de forma centralizada. Este microservicio no configura CORS.

---

## Acceso directo (desarrollo)

El microservicio acepta llamadas directas (sin Gateway) decodificando el JWT del header `Authorization: Bearer <token>` o la cookie `jwtToken`:

```bash
curl -X GET http://localhost:8085/api/profesor/materias \
  -H "Authorization: Bearer <JWT>"
```

Esto permite probar endpoints desde Bruno/Postman sin levantar todo el ecosistema. En producción, las peticiones deben pasar siempre por el Gateway.

---

## ms-rag (RAG Service — Variable `RAG_SERVICE_URL`)

**Función:** Servicio de recuperación aumentada por generación. Proporciona contexto del libro de Ciencias para generar preguntas con IA (HU11).

**Integración:** HTTP `POST` nativo (Node.js 20 `fetch`).

**Endpoint consumido:**

```
POST {RAG_SERVICE_URL}/api/rag/generate-quiz
Content-Type: application/json

{
  "tema": "Sistema solar",
  "materia": "Ciencias Naturales",
  "cantidad_preguntas": 5
}
```

**Respuesta esperada del ms-rag:**

```json
{
  "titulo": "Quiz sobre Sistema solar",
  "descripcion": "Generado automáticamente",
  "preguntas": [
    {
      "texto": "¿Cuántos planetas tiene el sistema solar?",
      "tipo": "single_choice",
      "tiempo_limite": 30,
      "opciones": [
        { "texto": "8", "orden": 1, "es_correcta": true },
        { "texto": "9", "orden": 2, "es_correcta": false },
        { "texto": "7", "orden": 3, "es_correcta": false },
        { "texto": "10", "orden": 4, "es_correcta": false }
      ]
    }
  ]
}
```

**Manejo de errores:**

| Escenario | Respuesta del Profesor MS |
|-----------|--------------------------|
| ms-rag no disponible | `503 Service Unavailable` |
| ms-rag responde con error HTTP | `502 Bad Gateway` con mensaje |
| `RAG_SERVICE_URL` no configurado | `503 Service Unavailable` |

---

## Socket.io (Tiempo real — mismo puerto 8085)

**Función:** Comunicación bidireccional durante la ejecución de un quiz (HU13).

**Flujo de integración:**
1. Frontend profesor conecta socket a `ws://[host]:8085`
2. Frontend estudiante conecta socket a `ws://[host]:8085`
3. Las acciones REST del profesor (`iniciar`, `siguiente-pregunta`, `finalizar`) emiten eventos a la sala Socket.io
4. Estudiantes reciben eventos en tiempo real sin polling

Ver eventos completos en [API.md#socketio--eventos](API.md#socketio--eventos).

---

## PostgreSQL (Base de datos compartida)

**Función:** Base de datos relacional compartida con `eduLLM-Admin-Back`.

**Conexión:** `DATABASE_URL` en `.env`

> Este microservicio solo **lee y escribe** en las tablas de su dominio. No crea ni modifica el esquema — eso lo gestiona Admin Back.

---

## Observabilidad (Red `observability-net`)

El contenedor se conecta a la red externa `observability-net` para enviar trazas a Grafana Alloy (OpenTelemetry). Esta red debe existir antes de levantar el contenedor:

```bash
docker network create observability-net
```

---

## Instrucciones para actualizar este doc
- Si se añade una integración externa → añade su sección con endpoint, payload y manejo de errores.
- Si cambia el contrato del ms-rag → actualiza la sección correspondiente.
- Si el Gateway cambia la forma de inyectar headers → actualiza la tabla de headers.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
