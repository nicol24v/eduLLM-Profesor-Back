# Diseño: Dashboard Analítico Educativo — Módulo 1 (Evolución Grupal)

**Fecha:** 2026-06-29  
**Proyecto:** `eduLLM-Profesor-BACK-dashboard` + `eduLLM-Front-Profesor`  
**Alcance:** Módulo 1 del dashboard analítico alineado a escala LOEI (Ecuador)

---

## 1. Contexto y objetivos

El profesor necesita ver el rendimiento de sus estudiantes a lo largo del período lectivo activo, expresado en la escala LOEI (1–10, mínimo aprobatorio 7.0) en lugar de puntos de videojuego crudos.

**Objetivo concreto:** agregar una sección de análisis al final de `DashboardPage.jsx` con dos gráficas:
1. **Línea de evolución grupal** — promedio de nota LOEI del grupo por fecha de partida
2. **Ranking horizontal** — nota LOEI promedio por estudiante, con colores de nivel

---

## 2. Escala LOEI

| Rango (nota 1–10) | Nivel | Abrev. | Color UI |
|---|---|---|---|
| 9.00–10.00 | Supera los Aprendizajes Requeridos | SAR | `#16a34a` (verde) |
| 8.00–8.99 | Domina los Aprendizajes Requeridos | DAR | `#84cc16` (lima) |
| 7.00–7.99 | Alcanza los Aprendizajes Requeridos | AAR | `#2563eb` (azul) |
| 5.00–6.99 | Próximo a Alcanzar los Aprendizajes | PAAR | `#f59e0b` (amarillo) |
| 1.00–4.99 | No Alcanza los Aprendizajes Requeridos | NAAR | `#dc2626` (rojo) |

**Conversión de puntaje de juego a nota LOEI:**
```
nota = clamp((puntaje_total / (total_preguntas × 1000)) × 10, 1.0, 10.0)
```
Redondeo a 2 decimales. Se usa `1000` como máximo por pregunta (valor establecido en el dominio de scoring existente).

---

## 3. Filtro de datos

- Solo partidas con `estado_partida = 'finalizada'`
- Solo del período lectivo con `es_activo = true`
- Solo las pruebas asignadas al profesor autenticado (vía `tbl_t_profesor_materia` → `tbl_t_prueba`)

---

## 4. Backend

### 4.1 Nuevo endpoint

`GET /api/profesor/dashboard/analitica`

Auth: `requireProfesor` middleware (cookie JWT, mismo que los otros endpoints del dashboard).

### 4.2 Respuesta

```json
{
  "data": {
    "evolucion": [
      {
        "fecha": "2026-05-10",
        "promedio_nota": 7.40,
        "total_participantes": 18
      }
    ],
    "ranking": [
      {
        "nombre": "Ana Torres",
        "nota_promedio": 8.20,
        "nivel_loei": "AAR",
        "partidas_jugadas": 5
      }
    ]
  }
}
```

- `evolucion` — lista ordenada por fecha (ASC). Un elemento por partida finalizada en el período activo.
- `ranking` — lista ordenada por `nota_promedio` DESC. Un elemento por estudiante que participó en al menos una partida.

### 4.3 Archivos nuevos en backend

| Archivo | Responsabilidad |
|---|---|
| `src/services/analitica.service.js` | Consultas Prisma + cálculo de nota LOEI + agrupación |
| `src/mappers/analitica.mapper.js` | Serialización de la respuesta al formato JSON anterior |

### 4.4 Archivos modificados en backend

| Archivo | Cambio |
|---|---|
| `src/routes/v1/dashboard.routes.js` | Añadir `router.get('/analitica', requireProfesor, controller.getAnalitica)` |
| `src/controllers/dashboard.controller.js` | Añadir método `getAnalitica` que delega a `analitica.service` |

### 4.5 Lógica de `analitica.service.js`

```
1. Resolver profesor por usuarioId
2. Obtener profesor_materia_ids WHERE profesor_id = X AND periodo_lectivo.es_activo = true
3. Obtener prueba_ids WHERE profesor_materia_id IN (...)
4. Obtener partidas WHERE prueba_id IN (...) AND estado_partida = 'finalizada'
5. Para cada partida:
   a. Contar preguntas (total_preguntas)
   b. Obtener tbl_t_partida_estudiante con puntaje_total y nombre de usuario
   c. Calcular nota_loei por participante
   d. Calcular promedio_nota del grupo para esa partida
6. Construir `evolucion[]` ordenada por fecha_creacion ASC
7. Agrupar notas por estudiante → calcular nota_promedio → construir `ranking[]`
```

---

## 5. Frontend

### 5.1 Dependencia nueva

```bash
npm install recharts
```
(en `eduLLM-Front-Profesor/`) — misma librería que usa el admin front, versión ^2.x compatible.

### 5.2 Archivos nuevos en frontend

| Archivo | Responsabilidad |
|---|---|
| `src/features/dashboard/AnalyticaSection.jsx` | Contenedor; título, estado vacío, grid de las dos tarjetas |
| `src/features/dashboard/EvolucionGrupalChart.jsx` | LineChart de Recharts (fecha vs nota LOEI) |
| `src/features/dashboard/RankingLoeiChart.jsx` | BarChart horizontal (estudiante vs nota LOEI) |
| `src/features/dashboard/hooks/useAnalitica.js` | React Query hook que llama `dashboardService.getAnalitica()` |

### 5.3 Archivos modificados en frontend

| Archivo | Cambio |
|---|---|
| `src/services/dashboardService.js` | Añadir `getAnalitica: () => api.get('/dashboard/analitica').then(r => r.data.data)` |
| `src/features/dashboard/DashboardPage.jsx` | Importar y renderizar `<AnalyticaSection />` al final |

### 5.4 `EvolucionGrupalChart.jsx`

- Recharts `<LineChart>` con datos `evolucion[]`
- Eje X: `fecha` (formato corto "DD/MM")
- Eje Y: 0–10 con `domain={[0, 10]}`
- `<ReferenceLine y={7} stroke="#f59e0b" label="Mín. aprobatorio" strokeDasharray="4 2" />`
- `<Tooltip>` formateado con 2 decimales y etiqueta "Nota promedio"
- Línea azul (`#2563eb`), `dot` activo en hover

### 5.5 `RankingLoeiChart.jsx`

- Recharts `<BarChart layout="vertical">`
- `<Bar>` con `<Cell fill={COLOR_POR_NIVEL[nivel_loei]}>` por cada estudiante
- Eje Y (izquierda): nombres de estudiantes
- Eje X (abajo): 0–10
- `<ReferenceLine x={7} stroke="#f59e0b" strokeDasharray="4 2" />`
- Tooltip: "X.XX — Nivel: AAR"

### 5.6 `AnalyticaSection.jsx`

- Si `isLoading`: mostrar 2 `<Skeleton>` de altura 220px (misma animación de `ChartSkeleton` usada en admin)
- Si `evolucion.length === 0 && ranking.length === 0`: mostrar `<EmptyState>` con mensaje "Aún no hay partidas finalizadas en el período activo"
- Layout: `grid grid-cols-1 md:grid-cols-2 gap-5` con tarjetas blancas `rounded-2xl shadow-md p-5`

### 5.7 `useAnalitica.js`

```js
import { useQuery } from '@tanstack/react-query';
import dashboardService from '../../../services/dashboardService';

export const useAnalitica = () =>
  useQuery({
    queryKey: ['dashboard-analitica'],
    queryFn: dashboardService.getAnalitica,
    staleTime: 5 * 60 * 1000,
  });
```

---

## 6. Convenciones de código

- Sin comentarios inline salvo invariantes no obvias
- Ningún manejo de error para casos imposibles (el `requireProfesor` ya garantiza que existe el profesor)
- Misma estructura de respuesta `{ data: {...} }` que el resto de endpoints del backend
- Misma estructura de tarjeta que `DashboardPage.jsx` (MUI `Card` + `CardContent` + className Tailwind)

---

## 7. Casos límite

| Caso | Comportamiento |
|---|---|
| Profesor sin período activo | `evolucion: [], ranking: []` — mostrar estado vacío |
| Partida sin estudiantes registrados | Excluir esa partida del cálculo |
| Estudiante sin nombre (nickname anónimo) | Usar el `nickname_opcional` o "Anónimo" |
| `puntaje_total = 0` y `total_preguntas > 0` | nota = 1.0 (mínimo clampeado) |

---

## 8. Fuera de alcance (esta iteración)

- Módulos 2, 3 y 4 (heatmaps, tendencias de riesgo, debilidades por tema)
- Filtro por materia
- Exportar datos a CSV/PDF
- Comparación entre períodos
