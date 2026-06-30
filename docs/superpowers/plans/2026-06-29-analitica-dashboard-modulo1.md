# Dashboard Analítico — Módulo 1 (Evolución Grupal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección de análisis LOEI al `DashboardPage` del profesor con gráfica de evolución grupal y ranking horizontal de estudiantes, alimentados por un nuevo endpoint `GET /api/profesor/dashboard/analitica`.

**Architecture:** Nuevo servicio `analitica.service.js` hace las consultas Prisma, `analitica.mapper.js` convierte puntos de juego a escala LOEI 1–10 y serializa la respuesta; el controlador y ruta existente del dashboard se extienden con un método nuevo. En el frontend se instala Recharts, se añaden tres archivos nuevos (`useAnalitica`, `EvolucionGrupalChart`, `RankingLoeiChart`, `AnalyticaSection`) y `DashboardPage` importa la sección al final.

**Tech Stack:** Node.js/Express, Prisma (PostgreSQL), React 18, Recharts ^2, @tanstack/react-query v5, MUI v5, TailwindCSS.

## Global Constraints

- Nota LOEI = `clamp((puntaje_total / (total_preguntas × 1000)) × 10, 1.0, 10.0)`, redondeado a 2 decimales.
- Solo partidas con `estado_partida = 'finalizada'` del período lectivo con `es_activo = true`.
- Niveles LOEI: SAR ≥ 9, DAR ≥ 8, AAR ≥ 7, PAAR ≥ 5, NAAR < 5.
- Colores LOEI: SAR=#16a34a, DAR=#84cc16, AAR=#2563eb, PAAR=#f59e0b, NAAR=#dc2626.
- Respuesta HTTP del backend: `{ success: true, data: { evolucion: [...], ranking: [...] } }`.
- Frontend: `api.get('/dashboard/analitica').then(r => r.data.data)` → `{ evolucion, ranking }`.
- Misma tarjeta visual que `DashboardCharts` del admin front: `rounded-2xl shadow-md p-5`, gradiente lateral de 1px, skeleton `animate-pulse` durante carga.
- No añadir comentarios excepto donde el `why` sea no obvio.

---

## Mapa de archivos

| Acción | Archivo | Repo |
|--------|---------|------|
| Crear | `src/services/analitica.service.js` | BACK |
| Crear | `src/mappers/analitica.mapper.js` | BACK |
| Modificar | `src/controllers/dashboard.controller.js` | BACK |
| Modificar | `src/routes/v1/dashboard.routes.js` | BACK |
| Instalar | `recharts` | FRONT |
| Modificar | `src/services/dashboardService.js` | FRONT |
| Crear | `src/features/dashboard/hooks/useAnalitica.js` | FRONT |
| Crear | `src/features/dashboard/EvolucionGrupalChart.jsx` | FRONT |
| Crear | `src/features/dashboard/RankingLoeiChart.jsx` | FRONT |
| Crear | `src/features/dashboard/AnalyticaSection.jsx` | FRONT |
| Modificar | `src/features/dashboard/DashboardPage.jsx` | FRONT |

---

## Task 1: Backend — Mapper + Servicio de analítica

**Files:**
- Create: `eduLLM-Profesor-BACK-dashboard/src/mappers/analitica.mapper.js`
- Create: `eduLLM-Profesor-BACK-dashboard/src/services/analitica.service.js`

**Interfaces:**
- Produces:
  - `AnaliticaMapper.toAnaliticaResponse({ partidas })` → `{ evolucion: EvolucionItem[], ranking: RankingItem[] }`
  - `EvolucionItem`: `{ fecha: string, promedio_nota: number, total_participantes: number }`
  - `RankingItem`: `{ nombre: string, nota_promedio: number, nivel_loei: string, partidas_jugadas: number }`
  - `analiticaService.getAnalitica(usuarioId: number)` → Promise de lo anterior

- [ ] **Step 1: Crear `analitica.mapper.js`**

Crea `src/mappers/analitica.mapper.js` con el siguiente contenido exacto:

```javascript
const MAX_PTS_POR_PREGUNTA = 1000;

function calcNota(puntajeTotal, totalPreguntas) {
  if (totalPreguntas === 0) return 1.0;
  const raw = (puntajeTotal / (totalPreguntas * MAX_PTS_POR_PREGUNTA)) * 10;
  return Math.min(10, Math.max(1, Math.round(raw * 100) / 100));
}

function nivelLoei(nota) {
  if (nota >= 9) return 'SAR';
  if (nota >= 8) return 'DAR';
  if (nota >= 7) return 'AAR';
  if (nota >= 5) return 'PAAR';
  return 'NAAR';
}

class AnaliticaMapper {
  static toAnaliticaResponse({ partidas }) {
    const evolucion = partidas.map((p) => {
      const totalPreguntas = p.tbl_t_prueba._count.tbl_t_pregunta;
      const notas = p.tbl_t_partida_estudiante.map(
        (pe) => calcNota(pe.puntaje_total || 0, totalPreguntas),
      );
      const promedio =
        notas.length > 0
          ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
          : 0;
      return {
        fecha: p.fecha_creacion.toISOString().split('T')[0],
        promedio_nota: promedio,
        total_participantes: notas.length,
      };
    });

    const porEstudiante = {};
    for (const p of partidas) {
      const totalPreguntas = p.tbl_t_prueba._count.tbl_t_pregunta;
      for (const pe of p.tbl_t_partida_estudiante) {
        const usuario = pe.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
        const nombre = usuario
          ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
          : pe.nickname_opcional || 'Anónimo';
        if (!porEstudiante[nombre]) porEstudiante[nombre] = { total: 0, count: 0 };
        porEstudiante[nombre].total += calcNota(pe.puntaje_total || 0, totalPreguntas);
        porEstudiante[nombre].count += 1;
      }
    }

    const ranking = Object.entries(porEstudiante)
      .map(([nombre, d]) => {
        const nota = Math.round((d.total / d.count) * 100) / 100;
        return {
          nombre,
          nota_promedio: nota,
          nivel_loei: nivelLoei(nota),
          partidas_jugadas: d.count,
        };
      })
      .sort((a, b) => b.nota_promedio - a.nota_promedio);

    return { evolucion, ranking };
  }
}

module.exports = AnaliticaMapper;
```

- [ ] **Step 2: Crear `analitica.service.js`**

Crea `src/services/analitica.service.js`:

```javascript
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const AnaliticaMapper = require('../mappers/analitica.mapper');

class AnaliticaService {
  async #getProfesorOrFail(usuarioId) {
    const profesor = await prisma.tbl_m_profesor.findUnique({
      where: { usuario_id: usuarioId, estado: true },
    });
    if (!profesor) throw new AppError('Profesor no encontrado', 404, 'PROFESOR_NOT_FOUND');
    return profesor;
  }

  async getAnalitica(usuarioId) {
    logger.info('Fetching analitica dashboard', { usuarioId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMaterias = await prisma.tbl_t_profesor_materia.findMany({
        where: {
          profesor_id: profesor.id_profesor,
          estado: true,
          tbl_m_periodo_lectivo: { es_activo: true },
        },
        select: { id_profesor_materia: true },
      });
      const profesorMateriaIds = profesorMaterias.map((pm) => pm.id_profesor_materia);

      if (profesorMateriaIds.length === 0) {
        return AnaliticaMapper.toAnaliticaResponse({ partidas: [] });
      }

      const pruebas = await prisma.tbl_t_prueba.findMany({
        where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
        select: { id_prueba: true },
      });
      const pruebaIds = pruebas.map((p) => p.id_prueba);

      if (pruebaIds.length === 0) {
        return AnaliticaMapper.toAnaliticaResponse({ partidas: [] });
      }

      const partidas = await prisma.tbl_t_partida.findMany({
        where: {
          prueba_id: { in: pruebaIds },
          estado_partida: 'finalizada',
          estado: true,
        },
        select: {
          id_partida: true,
          fecha_creacion: true,
          tbl_t_prueba: {
            select: {
              _count: { select: { tbl_t_pregunta: { where: { estado: true } } } },
            },
          },
          tbl_t_partida_estudiante: {
            where: { estado: true },
            select: {
              puntaje_total: true,
              nickname_opcional: true,
              tbl_m_estudiante_materia: {
                select: {
                  tbl_m_estudiante: {
                    select: {
                      tbl_m_usuario: {
                        select: { primer_nombre: true, apellido_paterno: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { fecha_creacion: 'asc' },
      });

      logger.info('Analitica fetched', { usuarioId, totalPartidas: partidas.length });
      return AnaliticaMapper.toAnaliticaResponse({ partidas });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching analitica', { usuarioId, error: error.message });
      throw error;
    }
  }
}

module.exports = new AnaliticaService();
```

- [ ] **Step 3: Verificar sintaxis del backend**

Desde el directorio `eduLLM-Profesor-BACK-dashboard/`, ejecuta:

```bash
node -e "require('./src/services/analitica.service'); require('./src/mappers/analitica.mapper'); console.log('OK')"
```

Salida esperada: `OK` (sin errores de `require`).

- [ ] **Step 4: Commit**

```bash
git add src/services/analitica.service.js src/mappers/analitica.mapper.js
git commit -m "feat: add analitica service and mapper with LOEI scoring"
```

---

## Task 2: Backend — Controlador + Ruta

**Files:**
- Modify: `eduLLM-Profesor-BACK-dashboard/src/controllers/dashboard.controller.js`
- Modify: `eduLLM-Profesor-BACK-dashboard/src/routes/v1/dashboard.routes.js`

**Interfaces:**
- Consumes: `analiticaService.getAnalitica(usuarioId)` del Task 1
- Produces: `GET /api/profesor/dashboard/analitica` → `{ success: true, data: { evolucion, ranking } }`

- [ ] **Step 1: Modificar `dashboard.controller.js`**

Abre `src/controllers/dashboard.controller.js`. El archivo actual termina con `module.exports = { getStats, getGraficas };`. Añade el require de `analiticaService` al tope y la función `getAnalitica` antes del export. El archivo completo debe quedar así:

```javascript
const catchAsync = require('../utils/catchAsync');
const dashboardService = require('../services/dashboard.service');
const analiticaService = require('../services/analitica.service');
const logger = require('../config/logger');

const getStats = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getDashboardStats', { usuarioId });
  const data = await dashboardService.getDashboardStats(usuarioId);
  res.json({ success: true, data });
});

const getGraficas = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getDashboardGraficas', { usuarioId });
  const data = await dashboardService.getGraficas(usuarioId);
  res.json({ success: true, data });
});

const getAnalitica = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getAnalitica', { usuarioId });
  const data = await analiticaService.getAnalitica(usuarioId);
  res.json({ success: true, data });
});

module.exports = { getStats, getGraficas, getAnalitica };
```

- [ ] **Step 2: Modificar `dashboard.routes.js`**

Abre `src/routes/v1/dashboard.routes.js`. El archivo actual tiene dos rutas. El archivo completo debe quedar así:

```javascript
const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const dashboardController = require('../../controllers/dashboard.controller');

router.get('/', requireProfesor, dashboardController.getStats);
router.get('/graficas', requireProfesor, dashboardController.getGraficas);
router.get('/analitica', requireProfesor, dashboardController.getAnalitica);

module.exports = router;
```

- [ ] **Step 3: Verificar que el servidor arranca sin errores**

Con el backend corriendo en Docker o local, verifica que las rutas se registraron:

```bash
node -e "const app = require('./src/app'); console.log('App loaded OK')"
```

Salida esperada: `App loaded OK`.

- [ ] **Step 4: Probar el endpoint con curl**

Con el backend corriendo (por ejemplo en `http://localhost:8082`) y teniendo una cookie JWT válida:

```bash
curl -s -b "jwtToken=<TU_TOKEN>" \
  http://localhost:8082/api/profesor/dashboard/analitica | python -m json.tool
```

Respuesta esperada (puede tener arrays vacíos si no hay partidas finalizadas):
```json
{
  "success": true,
  "data": {
    "evolucion": [],
    "ranking": []
  }
}
```

Si hay partidas finalizadas en el período activo, `evolucion` y `ranking` tendrán entradas.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/dashboard.controller.js src/routes/v1/dashboard.routes.js
git commit -m "feat: expose GET /dashboard/analitica endpoint"
```

---

## Task 3: Frontend — Instalar Recharts + Servicio + Hook

**Files:**
- Modify: `eduLLM-Front-Profesor/package.json` (via npm install)
- Modify: `eduLLM-Front-Profesor/src/services/dashboardService.js`
- Create: `eduLLM-Front-Profesor/src/features/dashboard/hooks/useAnalitica.js`

**Interfaces:**
- Produces:
  - `dashboardService.getAnalitica()` → `Promise<{ evolucion: EvolucionItem[], ranking: RankingItem[] }>`
  - `useAnalitica()` → `{ data, isLoading, isError }` (React Query result)

- [ ] **Step 1: Instalar Recharts**

Desde el directorio `eduLLM-Front-Profesor/`:

```bash
npm install recharts
```

Verificar que se agregó a `package.json`:

```bash
node -e "const p = require('./package.json'); console.log('recharts:', p.dependencies.recharts)"
```

Salida esperada: `recharts: ^2.x.x` (o similar).

- [ ] **Step 2: Añadir `getAnalitica` a `dashboardService.js`**

Abre `src/services/dashboardService.js`. El archivo actual tiene `getStats` y `getGraficas`. Reemplaza el contenido completo:

```javascript
import api from './api';

const dashboardService = {
  getStats: () => api.get('/dashboard').then((r) => r.data.data),
  getGraficas: () => api.get('/dashboard/graficas').then((r) => r.data.data),
  getAnalitica: () => api.get('/dashboard/analitica').then((r) => r.data.data),
};

export default dashboardService;
```

- [ ] **Step 3: Crear `useAnalitica.js`**

Crea `src/features/dashboard/hooks/useAnalitica.js`:

```javascript
import { useQuery } from '@tanstack/react-query';
import dashboardService from '../../../services/dashboardService';

export function useAnalitica() {
  return useQuery({
    queryKey: ['dashboard-analitica'],
    queryFn: dashboardService.getAnalitica,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Verificar que Vite compila sin errores**

```bash
npm run build
```

Salida esperada: build exitoso, sin errores de TypeScript ni imports rotos. (Puede haber warnings de tamaño de bundle — ignorar.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/dashboardService.js src/features/dashboard/hooks/useAnalitica.js
git commit -m "feat: add recharts, dashboardService.getAnalitica, useAnalitica hook"
```

---

## Task 4: Frontend — Componentes de gráficas

**Files:**
- Create: `eduLLM-Front-Profesor/src/features/dashboard/EvolucionGrupalChart.jsx`
- Create: `eduLLM-Front-Profesor/src/features/dashboard/RankingLoeiChart.jsx`

**Interfaces:**
- Consumes: nada de tareas anteriores directamente (reciben props)
- `EvolucionGrupalChart` props: `{ data: EvolucionItem[] }` donde `EvolucionItem = { fecha: string, promedio_nota: number, total_participantes: number }`
- `RankingLoeiChart` props: `{ data: RankingItem[] }` donde `RankingItem = { nombre: string, nota_promedio: number, nivel_loei: string, partidas_jugadas: number }`
- Produces: componentes React exportados como default

- [ ] **Step 1: Crear `EvolucionGrupalChart.jsx`**

Crea `src/features/dashboard/EvolucionGrupalChart.jsx`:

```jsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-blue-600">
        Nota promedio: <span className="font-bold">{payload[0].value.toFixed(2)}</span>
      </p>
      <p className="text-slate-500">Participantes: {payload[0].payload.total_participantes}</p>
    </div>
  );
};

export default function EvolucionGrupalChart({ data }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
        Sin datos de evolución aún
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    fechaLabel: d.fecha.slice(5).replace('-', '/'),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="fechaLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={7}
          stroke="#f59e0b"
          strokeDasharray="4 2"
          label={{ value: 'Mín. 7.0', position: 'insideTopLeft', fontSize: 10, fill: '#f59e0b' }}
        />
        <Line
          type="monotone"
          dataKey="promedio_nota"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: '#2563eb' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Crear `RankingLoeiChart.jsx`**

Crea `src/features/dashboard/RankingLoeiChart.jsx`:

```jsx
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from 'recharts';

const LOEI_COLORS = {
  SAR: '#16a34a',
  DAR: '#84cc16',
  AAR: '#2563eb',
  PAAR: '#f59e0b',
  NAAR: '#dc2626',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1 truncate max-w-[160px]">{d.nombre}</p>
      <p style={{ color: LOEI_COLORS[d.nivel_loei] }}>
        Nota: <span className="font-bold">{d.nota_promedio.toFixed(2)}</span> — {d.nivel_loei}
      </p>
      <p className="text-slate-500">Partidas: {d.partidas_jugadas}</p>
    </div>
  );
};

export default function RankingLoeiChart({ data }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
        Sin datos de ranking aún
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis
          type="category"
          dataKey="nombre"
          width={110}
          tick={{ fontSize: 11, fill: '#64748b' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine x={7} stroke="#f59e0b" strokeDasharray="4 2" />
        <Bar dataKey="nota_promedio" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={LOEI_COLORS[entry.nivel_loei] ?? '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Verificar build sin errores**

```bash
npm run build
```

Salida esperada: build exitoso. Si Vite reporta `"recharts" is not installed`, asegúrate de que el Task 3 Step 1 se completó.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/EvolucionGrupalChart.jsx src/features/dashboard/RankingLoeiChart.jsx
git commit -m "feat: add EvolucionGrupalChart and RankingLoeiChart with LOEI colors"
```

---

## Task 5: Frontend — `AnalyticaSection` + wiring en `DashboardPage`

**Files:**
- Create: `eduLLM-Front-Profesor/src/features/dashboard/AnalyticaSection.jsx`
- Modify: `eduLLM-Front-Profesor/src/features/dashboard/DashboardPage.jsx`

**Interfaces:**
- Consumes:
  - `useAnalitica()` del Task 3 → `{ data: { evolucion, ranking }, isLoading, isError }`
  - `EvolucionGrupalChart` del Task 4 → prop `data={evolucion}`
  - `RankingLoeiChart` del Task 4 → prop `data={ranking}`
- Produces: `<AnalyticaSection />` — componente sin props, auto-contenido

- [ ] **Step 1: Crear `AnalyticaSection.jsx`**

Crea `src/features/dashboard/AnalyticaSection.jsx`:

```jsx
import React from 'react';
import { Skeleton } from '@mui/material';
import { useAnalitica } from './hooks/useAnalitica';
import EvolucionGrupalChart from './EvolucionGrupalChart';
import RankingLoeiChart from './RankingLoeiChart';

const LOEI_LEGEND = [
  { nivel: 'SAR', label: 'Supera (9–10)', color: '#16a34a' },
  { nivel: 'DAR', label: 'Domina (8–8.99)', color: '#84cc16' },
  { nivel: 'AAR', label: 'Alcanza (7–7.99)', color: '#2563eb' },
  { nivel: 'PAAR', label: 'Próximo (5–6.99)', color: '#f59e0b' },
  { nivel: 'NAAR', label: 'No alcanza (<5)', color: '#dc2626' },
];

const ChartCard = ({ title, subtitle, gradient, children }) => (
  <div className="bg-white rounded-2xl shadow-md p-5 hover:shadow-lg transition-shadow duration-200">
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-1 h-10 rounded-full bg-gradient-to-b ${gradient} flex-shrink-0`} />
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

const ChartSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-1/3 mb-4" />
    <div className="h-48 bg-gray-100 rounded-xl" />
  </div>
);

export default function AnalyticaSection() {
  const { data, isLoading, isError } = useAnalitica();

  const evolucion = data?.evolucion ?? [];
  const ranking = data?.ranking ?? [];
  const isEmpty = !isLoading && !isError && evolucion.length === 0 && ranking.length === 0;

  return (
    <div className="mt-8">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">Análisis del período activo</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Escala LOEI · Nota mínima aprobatoria 7.00
        </p>
      </div>

      {isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          Error al cargar análisis. Verifica la conexión con el servidor.
        </div>
      )}

      {isEmpty && (
        <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-center text-slate-500 text-sm">
          Aún no hay partidas finalizadas en el período activo.
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            {LOEI_LEGEND.map((l) => (
              <div key={l.nivel} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: l.color }}
                />
                <span className="text-xs text-slate-600">{l.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ChartCard
              title="Evolución del grupo"
              subtitle="Promedio LOEI por partida finalizada"
              gradient="from-blue-500 to-blue-600"
            >
              {isLoading ? <ChartSkeleton /> : <EvolucionGrupalChart data={evolucion} />}
            </ChartCard>

            <ChartCard
              title="Ranking estudiantil"
              subtitle="Nota LOEI promedio por estudiante"
              gradient="from-emerald-500 to-emerald-600"
            >
              {isLoading ? <ChartSkeleton /> : <RankingLoeiChart data={ranking} />}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modificar `DashboardPage.jsx` para incluir `AnalyticaSection`**

Abre `src/features/dashboard/DashboardPage.jsx`. Añade el import de `AnalyticaSection` justo después de la última línea de imports existente:

```jsx
import AnalyticaSection from './AnalyticaSection';
```

Luego, al final del `return`, después del cierre de la Card de "Materias asignadas" (la `</Card>` del bloque de materias) y antes del `</div>` que cierra el componente, añade:

```jsx
      <AnalyticaSection />
    </div>
```

El bloque final del return de `DashboardPage` debe verse así:

```jsx
      {/* Materias asignadas */}
      <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        {/* ... contenido sin cambios ... */}
      </Card>

      <AnalyticaSection />
    </div>
```

- [ ] **Step 3: Verificar build final**

```bash
npm run build
```

Salida esperada: build exitoso sin errores de importación.

- [ ] **Step 4: Arrancar el servidor de desarrollo y verificar en browser**

```bash
npm run dev
```

1. Navega a `http://localhost:8002` (o el puerto del frontend del profesor).
2. Inicia sesión como `profesor1` / `123`.
3. Ve al Dashboard (`/dashboard`).
4. Verifica que al final de la página aparece la sección "Análisis del período activo".
5. Si hay partidas finalizadas en el período activo: deben aparecer la línea de evolución y el ranking.
6. Si no hay partidas: debe aparecer el mensaje "Aún no hay partidas finalizadas en el período activo."
7. Abre DevTools → Network y confirma que `GET /api/profesor/dashboard/analitica` retorna 200 con `{ success: true, data: { evolucion: [...], ranking: [...] } }`.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/AnalyticaSection.jsx src/features/dashboard/DashboardPage.jsx
git commit -m "feat: add AnalyticaSection with LOEI charts to DashboardPage"
```

---

## Self-Review

| Requisito del spec | Task que lo implementa |
|---|---|
| `GET /api/profesor/dashboard/analitica` | Task 2 |
| Solo período activo (`es_activo = true`) | Task 1 (service, filtro en `profesorMaterias`) |
| Solo `estado_partida = 'finalizada'` | Task 1 (service, filtro en `partidas`) |
| `nota = clamp((puntaje / (n × 1000)) × 10, 1, 10)` | Task 1 (mapper, `calcNota`) |
| Niveles LOEI con rangos correctos | Task 1 (mapper, `nivelLoei`) |
| Colores LOEI en ranking | Task 4 (`RankingLoeiChart`, `LOEI_COLORS`) |
| Línea de referencia en 7.0 | Task 4 (`EvolucionGrupalChart` y `RankingLoeiChart`) |
| Skeleton durante carga | Task 5 (`AnalyticaSection`, `ChartSkeleton`) |
| Estado vacío con mensaje | Task 5 (`AnalyticaSection`, `isEmpty`) |
| Sección al final del Dashboard actual | Task 5 (`DashboardPage.jsx`) |
| Recharts instalado | Task 3 |
| `staleTime: 5 × 60 × 1000` en React Query | Task 3 (`useAnalitica`) |
| Estudiante anónimo → nickname o "Anónimo" | Task 1 (mapper, `porEstudiante`) |
| `puntaje_total = 0` → nota = 1.0 | Task 1 (mapper, `calcNota`, clamp min 1) |
| Sin período activo → arrays vacíos | Task 1 (service, early return) |
