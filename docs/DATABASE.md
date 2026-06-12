[← Volver al índice](INDEX.md)

# Base de datos — Profesor MS

> **Nota para IA:** Este microservicio comparte la misma base de datos que `eduLLM-Admin-Back`. No tiene migraciones propias. Usa Prisma `db pull` para sincronizar el schema. Las tablas con prefijo `tbl_t_` son transaccionales (quiz); las `tbl_m_` son maestras.

## Datos de conexión

| Campo | Valor |
|-------|-------|
| **SGBD** | PostgreSQL |
| **Base de datos** | `edu_llm` |
| **Schema** | `comun` |
| **ORM** | Prisma 5 (`@prisma/client`) |
| **Config** | `DATABASE_URL` en `.env` |
| **Schema file** | `prisma/schema.prisma` |

## Convenciones de nombres

- Tablas: `tbl_[tipo]_[entidad]` — `tbl_m_` maestras, `tbl_t_` transaccionales
- PKs: `id_[entidad]` (INTEGER SERIAL)
- FKs: `[entidad]_id` o `id_[entidad]`
- Auditoría: `fecha_creacion`, `usuario_creacion`, `fecha_modificacion`, `usuario_modificacion` en todas las tablas
- Soft delete: columna `estado BOOLEAN DEFAULT true` (false = eliminado)

---

## Tablas usadas por este microservicio

### `tbl_m_usuario`
Usuarios del sistema (profesores, estudiantes, administradores).

| Columna | Tipo | Restricciones | Default | Descripción |
|---------|------|---------------|---------|-------------|
| `id_usuario` | INTEGER | PK | autoincrement | Identificador único |
| `cedula` | VARCHAR(20) | NOT NULL | — | Cédula de identidad |
| `username` | VARCHAR(100) | NOT NULL, UNIQUE | — | Nombre de usuario |
| `primer_nombre` | VARCHAR(100) | NOT NULL | — | Primer nombre |
| `segundo_nombre` | VARCHAR(100) | — | — | Segundo nombre |
| `apellido_paterno` | VARCHAR(100) | NOT NULL | — | Apellido paterno |
| `apellido_materno` | VARCHAR(100) | — | — | Apellido materno |
| `password_hash` | VARCHAR(255) | NOT NULL | — | Contraseña hasheada (bcrypt) |
| `rol_id` | INTEGER | NOT NULL | — | FK → `tbl_m_rol.id_rol` |
| `correo` | VARCHAR | — | — | Correo electrónico |
| `estado` | BOOLEAN | — | `true` | Activo/inactivo |

**Relaciones:** → `tbl_m_profesor.usuario_id`, `tbl_m_estudiante.id_usuario`, `tbl_m_administrador.usuario_id`

---

### `tbl_m_profesor`
Perfil extendido de un usuario con rol Profesor.

| Columna | Tipo | Restricciones | Default | Descripción |
|---------|------|---------------|---------|-------------|
| `id_profesor` | INTEGER | PK | autoincrement | Identificador del profesor |
| `usuario_id` | INTEGER | NOT NULL, UNIQUE | — | FK → `tbl_m_usuario.id_usuario` |
| `especialidad` | VARCHAR(100) | — | — | Área de especialización |
| `estado` | BOOLEAN | — | `true` | Activo/inactivo |

---

### `tbl_t_profesor_materia`
Asignación de un profesor a una materia en un periodo lectivo.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id_profesor_materia` | INTEGER | PK | Identificador de la asignación |
| `profesor_id` | INTEGER | FK | → `tbl_m_profesor` |
| `materia_id` | INTEGER | FK | → `tbl_m_materia` |
| `periodo_lectivo_id` | INTEGER | FK | → `tbl_m_periodo_lectivo` |
| `estado` | BOOLEAN | default true | Activo |

**Índices únicos:** `(profesor_id, materia_id)` y `(profesor_id, materia_id, periodo_lectivo_id)`

---

### `tbl_m_materia`
Catálogo de materias.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_materia` | INTEGER PK | — |
| `nombre` | VARCHAR(100) NOT NULL | Nombre de la materia |
| `nombre_normalizado` | VARCHAR | Para búsqueda sin tildes |
| `grado_id` | INTEGER FK | → `tbl_m_grado` |
| `estado` | BOOLEAN | Activo |

**Índice único:** `(nombre_normalizado, grado_id)`

---

### `tbl_m_grado`
Grados escolares.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_grado` | INTEGER PK | — |
| `grado` | INTEGER | Número del grado (ej. 4) |
| `paralelo` | VARCHAR(1) | Paralelo (A, B, C…) |

---

### `tbl_m_periodo_lectivo`
Periodos académicos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_periodo_lectivo` | INTEGER PK | — |
| `nombre` | VARCHAR(100) | Ej. "2026-I" |
| `fecha_inicio` | DATE | — |
| `fecha_fin` | DATE | — |
| `es_activo` | BOOLEAN | Periodo vigente |

---

### `tbl_m_estudiante`
Perfil extendido de usuario con rol Estudiante.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_estudiante` | INTEGER PK | — |
| `id_usuario` | INTEGER UNIQUE FK | → `tbl_m_usuario` |

---

### `tbl_m_estudiante_materia`
Matrícula de un estudiante en una materia.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_estudiante_materia` | INTEGER PK | — |
| `id_estudiante` | INTEGER FK | → `tbl_m_estudiante` |
| `id_materia` | INTEGER FK | → `tbl_m_materia` |
| `id_periodo_lectivo` | INTEGER FK | → `tbl_m_periodo_lectivo` |
| `fecha_inscripcion` | TIMESTAMPTZ | — |
| `fecha_retiro` | TIMESTAMPTZ | NULL si activo |
| `estado` | BOOLEAN | Activo |

---

### `tbl_t_prueba`
Cuestionario/prueba creada por un profesor.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_prueba` | INTEGER PK | — |
| `titulo` | VARCHAR(255) NOT NULL | Título del cuestionario |
| `descripcion` | TEXT | Descripción opcional |
| `configuracion` | JSON | Opciones de configuración libre |
| `profesor_materia_id` | INTEGER FK | → `tbl_t_profesor_materia` (qué profesor en qué materia) |
| `estado` | BOOLEAN | Soft delete |

---

### `tbl_t_pregunta`
Pregunta perteneciente a una prueba.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id_pregunta` | INTEGER PK | — | — |
| `prueba_id` | INTEGER FK | — | → `tbl_t_prueba` |
| `texto` | TEXT NOT NULL | — | Enunciado de la pregunta |
| `tipo` | VARCHAR(20) | `'single_choice'` | Tipo de pregunta |
| `tiempo_limite` | INTEGER | `30` | Segundos para responder |
| `cooldown` | INTEGER | `5` | Segundos entre preguntas |
| `image_url` | TEXT | — | URL de imagen opcional |
| `audio_url` | TEXT | — | URL de audio opcional |
| `video_url` | TEXT | — | URL de video opcional |
| `estado` | BOOLEAN | `true` | Soft delete |

---

### `tbl_t_opcion`
Opción de respuesta para una pregunta.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id_opcion` | INTEGER PK | — | — |
| `pregunta_id` | INTEGER FK | — | → `tbl_t_pregunta` |
| `texto` | TEXT NOT NULL | — | Texto de la opción |
| `orden` | INTEGER | — | Orden de presentación |
| `es_correcta` | BOOLEAN | `false` | Si es la respuesta correcta |
| `estado` | BOOLEAN | `true` | Soft delete |

---

### `tbl_t_partida`
Sesión de quiz activa o terminada.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id_partida` | INTEGER PK | — | — |
| `prueba_id` | INTEGER FK | — | → `tbl_t_prueba` |
| `codigo_acceso` | VARCHAR(6) | — | **UNIQUE** — código para unirse |
| `estado_partida` | VARCHAR(20) | `'esperando'` | `esperando` / `en_curso` / `finalizada` |
| `iniciado_en` | TIMESTAMPTZ | — | Momento en que inició |
| `finalizado_en` | TIMESTAMPTZ | — | Momento en que finalizó |
| `estado` | BOOLEAN | `true` | Soft delete |

**Ciclo de vida:** `esperando` → `en_curso` → `finalizada`

---

### `tbl_t_partida_estudiante`
Participación de un estudiante en una partida.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id_partida_estudiante` | INTEGER PK | — | — |
| `partida_id` | INTEGER FK | — | → `tbl_t_partida` |
| `estudiante_materia_id` | INTEGER FK | — | → `tbl_m_estudiante_materia` (nullable para invitados) |
| `nickname_opcional` | VARCHAR(100) | — | Para participantes sin cuenta |
| `puntaje_total` | INTEGER | `0` | Puntaje acumulado |
| `respuestas_correctas` | INTEGER | `0` | Contador de aciertos |
| `estado` | BOOLEAN | `true` | Activo |

---

### `tbl_t_respuesta`
Respuesta individual de un estudiante a una pregunta.

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id_respuesta` | INTEGER PK | — | — |
| `partida_estudiante_id` | INTEGER FK | — | → `tbl_t_partida_estudiante` |
| `pregunta_id` | INTEGER FK | — | → `tbl_t_pregunta` |
| `opcion_seleccionada_id` | INTEGER FK | — | → `tbl_t_opcion` (nullable si no respondió) |
| `tiempo_ms` | INTEGER | — | Tiempo en ms que tardó en responder |
| `puntaje_obtenido` | INTEGER | `0` | Puntaje calculado (función del tiempo) |
| `estado` | BOOLEAN | `true` | Activo |

---

### `tbl_t_retroalimentacion_llm`
Retroalimentación generada por LLM al final de una partida.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_retroalimentacion` | INTEGER PK | — |
| `partida_estudiante_id` | INTEGER | Referencia (sin FK declarada) |
| `preguntas_falladas` | JSON | Lista de preguntas incorrectas |
| `prompt_enviado` | TEXT | Prompt enviado al LLM |
| `respuesta_llm` | TEXT | Respuesta del LLM |
| `modelo_usado` | VARCHAR(100) | Modelo LLM utilizado |

---

## Diagrama de relaciones (simplificado)

```
tbl_m_usuario ──────┬──► tbl_m_profesor ──► tbl_t_profesor_materia ──► tbl_t_prueba
                    └──► tbl_m_estudiante ──► tbl_m_estudiante_materia       │
                                                      │                      ▼
tbl_m_materia ──────────────────────────────────────┘          tbl_t_pregunta ──► tbl_t_opcion
tbl_m_periodo_lectivo ──────────────────────────────┘                │                │
                                                                      │                │
tbl_t_partida ◄─── tbl_t_prueba                                      │                │
      │                                                               │                │
      └──► tbl_t_partida_estudiante ──────────────────────────────── ▼                │
                    │                                        tbl_t_respuesta ◄─────────┘
                    └──► tbl_t_retroalimentacion_llm
```

---

## Migraciones

Este microservicio **no ejecuta migraciones propias**. La BD es mantenida por `eduLLM-Admin-Back`. Para sincronizar el schema local:

```bash
npx prisma db pull    # Introspección desde la BD
npx prisma generate   # Regenerar el cliente Prisma
```

---

## Instrucciones para actualizar este doc
- Si se añade/modifica una tabla → actualiza la sección correspondiente y el diagrama.
- Si cambia el schema Prisma → regenerar con `prisma generate` y actualizar este doc.

*Última revisión: 2026-06-11 · commit inicial*

[← Volver al índice](INDEX.md)
