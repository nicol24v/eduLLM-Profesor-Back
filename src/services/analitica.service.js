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
        return AnaliticaMapper.toAnaliticaResponse({ partidas: [], respuestas: [], pruebaTituloMap: {} });
      }

      const pruebas = await prisma.tbl_t_prueba.findMany({
        where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
        select: { id_prueba: true, titulo: true },
      });
      const pruebaIds = pruebas.map((p) => p.id_prueba);
      const pruebaTituloMap = Object.fromEntries(pruebas.map((p) => [p.id_prueba, p.titulo]));

      if (pruebaIds.length === 0) {
        return AnaliticaMapper.toAnaliticaResponse({ partidas: [], respuestas: [], pruebaTituloMap });
      }

      const partidas = await prisma.tbl_t_partida.findMany({
        where: {
          prueba_id: { in: pruebaIds },
          estado_partida: 'finalizada',
          estado: true,
        },
        select: {
          id_partida: true,
          prueba_id: true,
          fecha_creacion: true,
          tbl_t_prueba: {
            select: {
              titulo: true,
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

      const partidaIds = partidas.map((p) => p.id_partida);

      const respuestas = partidaIds.length > 0
        ? await prisma.tbl_t_respuesta.findMany({
            where: {
              estado: true,
              tbl_t_partida_estudiante: { partida_id: { in: partidaIds } },
            },
            select: {
              pregunta_id: true,
              tbl_t_opcion: { select: { es_correcta: true } },
              tbl_t_pregunta: { select: { texto: true, prueba_id: true } },
            },
          })
        : [];

      logger.info('Analitica fetched', {
        usuarioId,
        totalPartidas: partidas.length,
        totalRespuestas: respuestas.length,
      });

      return AnaliticaMapper.toAnaliticaResponse({ partidas, respuestas, pruebaTituloMap });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching analitica', { usuarioId, error: error.message });
      throw error;
    }
  }
}

module.exports = new AnaliticaService();
