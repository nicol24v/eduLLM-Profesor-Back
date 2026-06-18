const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const DashboardMapper = require('../mappers/dashboard.mapper');

class DashboardService {
  async #getProfesorOrFail(usuarioId) {
    logger.debug('Looking up profesor by usuario', { usuarioId });
    const profesor = await prisma.tbl_m_profesor.findUnique({
      where: { usuario_id: usuarioId, estado: true },
    });
    if (!profesor) {
      logger.warn('Profesor not found', { usuarioId });
      throw new AppError('Profesor no encontrado', 404, 'PROFESOR_NOT_FOUND');
    }
    return profesor;
  }

  async getDashboardStats(usuarioId) {
    logger.info('Fetching dashboard stats', { usuarioId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMaterias = await prisma.tbl_t_profesor_materia.findMany({
        where: { profesor_id: profesor.id_profesor, estado: true },
        include: {
          tbl_m_materia: { select: { nombre: true } },
          tbl_m_periodo_lectivo: { select: { nombre: true, es_activo: true } },
        },
      });

      const profesorMateriaIds = profesorMaterias.map((pm) => pm.id_profesor_materia);
      const materiasIds = profesorMaterias.map((pm) => pm.materia_id);

      const estudiantesUnicos = await prisma.tbl_m_estudiante_materia.findMany({
        where: { id_materia: { in: materiasIds }, estado: true },
        select: { id_estudiante: true },
        distinct: ['id_estudiante'],
      });

      const cuestionariosCount = await prisma.tbl_t_prueba.count({
        where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
      });

      const pruebas = await prisma.tbl_t_prueba.findMany({
        where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
        select: { id_prueba: true },
      });
      const pruebasIds = pruebas.map((p) => p.id_prueba);

      const partidasPendientes = await prisma.tbl_t_partida.findMany({
        where: {
          prueba_id: { in: pruebasIds },
          estado_partida: { in: ['esperando', 'en_curso'] },
          estado: true,
        },
        include: { tbl_t_prueba: { select: { titulo: true } } },
        orderBy: { fecha_creacion: 'desc' },
        take: 10,
      });

      logger.info('Dashboard stats fetched', {
        usuarioId,
        profesorId: profesor.id_profesor,
        totalMaterias: profesorMaterias.length,
        totalEstudiantes: estudiantesUnicos.length,
        totalCuestionarios: cuestionariosCount,
      });

      return DashboardMapper.toStatsResponse({
        totalEstudiantes: estudiantesUnicos.length,
        totalCuestionarios: cuestionariosCount,
        totalMaterias: profesorMaterias.length,
        partidasPendientes,
        materias: profesorMaterias,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching dashboard stats', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getGraficas(usuarioId) {
    logger.info('Fetching dashboard graficas', { usuarioId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMaterias = await prisma.tbl_t_profesor_materia.findMany({
        where: { profesor_id: profesor.id_profesor, estado: true },
      });
      const profesorMateriaIds = profesorMaterias.map((pm) => pm.id_profesor_materia);

      const pruebas = await prisma.tbl_t_prueba.findMany({
        where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
        select: { id_prueba: true, titulo: true },
      });
      const pruebasIds = pruebas.map((p) => p.id_prueba);

      const partidas = await prisma.tbl_t_partida.findMany({
        where: {
          prueba_id: { in: pruebasIds },
          estado_partida: 'finalizada',
          estado: true,
        },
        select: { id_partida: true, prueba_id: true },
      });
      const partidaIds = partidas.map((p) => p.id_partida);

      if (partidaIds.length === 0) {
        logger.info('No finalized partidas for graficas', { usuarioId, profesorId: profesor.id_profesor });
        return DashboardMapper.toGraficasResponse({
          barraHorizontal: [],
          barraVertical: [],
          distribucion: { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 },
        });
      }

      const participaciones = await prisma.tbl_t_partida_estudiante.findMany({
        where: { partida_id: { in: partidaIds }, estado: true },
        include: {
          tbl_t_partida: { select: { prueba_id: true } },
          tbl_m_estudiante_materia: {
            include: {
              tbl_m_estudiante: {
                include: {
                  tbl_m_usuario: { select: { primer_nombre: true, apellido_paterno: true } },
                },
              },
            },
          },
        },
      });

      const porEstudiante = {};
      participaciones.forEach((p) => {
        const usuario = p.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
        const nombre = usuario
          ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
          : p.nickname_opcional || 'Anónimo';

        if (!porEstudiante[nombre]) porEstudiante[nombre] = { total: 0, count: 0 };
        porEstudiante[nombre].total += p.puntaje_total || 0;
        porEstudiante[nombre].count += 1;
      });

      const barraHorizontal = Object.entries(porEstudiante).map(([nombre, d]) => ({
        estudiante: nombre,
        puntaje_promedio: d.count > 0 ? Math.round(d.total / d.count) : 0,
      }));

      const porQuiz = {};
      participaciones.forEach((p) => {
        const pruebaId = p.tbl_t_partida.prueba_id;
        const titulo = pruebas.find((pr) => pr.id_prueba === pruebaId)?.titulo || `Quiz #${pruebaId}`;

        if (!porQuiz[titulo]) porQuiz[titulo] = { total: 0, count: 0 };
        porQuiz[titulo].total += p.puntaje_total || 0;
        porQuiz[titulo].count += 1;
      });

      const barraVertical = Object.entries(porQuiz).map(([titulo, d]) => ({
        quiz: titulo,
        puntaje_promedio: d.count > 0 ? Math.round(d.total / d.count) : 0,
      }));

      const pruebaPreguntas = {};
      for (const prueba of pruebas) {
        const count = await prisma.tbl_t_pregunta.count({
          where: { prueba_id: prueba.id_prueba, estado: true },
        });
        pruebaPreguntas[prueba.id_prueba] = count;
      }

      const distribucion = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
      participaciones.forEach((p) => {
        const pruebaId = p.tbl_t_partida.prueba_id;
        const maxPts = (pruebaPreguntas[pruebaId] || 1) * 1000;
        const pct = Math.min(100, Math.round(((p.puntaje_total || 0) / maxPts) * 100));

        if (pct <= 20) distribucion['0-20']++;
        else if (pct <= 40) distribucion['21-40']++;
        else if (pct <= 60) distribucion['41-60']++;
        else if (pct <= 80) distribucion['61-80']++;
        else distribucion['81-100']++;
      });

      logger.info('Dashboard graficas fetched', { usuarioId, profesorId: profesor.id_profesor, totalParticipaciones: participaciones.length });

      return DashboardMapper.toGraficasResponse({
        barraHorizontal,
        barraVertical,
        distribucion,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching dashboard graficas', { usuarioId, error: error.message });
      throw error;
    }
  }
}

module.exports = new DashboardService();
