const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { generateAccessCode } = require('../utils/codeGenerator');
const PartidaRepository = require('../repositories/partida.repository');
const PartidaMapper = require('../mappers/partida.mapper');

class PartidaService {
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

  async #assertPartidaOwnership(partidaId, profesor) {
    logger.debug('Asserting partida ownership', { partidaId, profesorId: profesor.id_profesor });
    const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);

    const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds);

    const partida = await prisma.tbl_t_partida.findFirst({
      where: { id_partida: partidaId, prueba_id: { in: pruebasIds }, estado: true },
      include: {
        tbl_t_prueba: {
          include: {
            tbl_t_pregunta: { where: { estado: true }, orderBy: { id_pregunta: 'asc' } },
          },
        },
      },
    });
    if (!partida) {
      logger.warn('Partida ownership assertion failed', { partidaId, profesorId: profesor.id_profesor });
      throw new AppError('Partida no encontrada o sin acceso', 404, 'PARTIDA_NOT_FOUND');
    }
    return partida;
  }

  async getHistory(usuarioId, { page, limit, prueba_id }) {
    logger.info('Fetching partida history', { usuarioId, page, limit, prueba_id });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);
      const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds, prueba_id);

      const skip = (page - 1) * limit;

      const [total, partidas] = await Promise.all([
        PartidaRepository.countByPruebaIds(pruebasIds),
        PartidaRepository.findPaginated(pruebasIds, skip, limit),
      ]);

      logger.info('Partida history fetched', { usuarioId, total, page, limit });
      return PartidaMapper.toHistoryListResponse(partidas, {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching partida history', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getById(usuarioId, partidaId) {
    logger.info('Fetching partida by id', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      return await this.#assertPartidaOwnership(partidaId, profesor);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching partida by id', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async create(usuarioId, body) {
    logger.info('Creating partida', { usuarioId, prueba_id: body.prueba_id });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      const { prueba_id } = body;

      if (!prueba_id) throw new AppError('El prueba_id es requerido', 400, 'PRUEBA_ID_REQUIRED');

      const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);
      const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds);

      const prueba = await prisma.tbl_t_prueba.findFirst({
        where: { id_prueba: parseInt(prueba_id, 10), profesor_materia_id: { in: profesorMateriaIds }, estado: true },
        include: { tbl_t_pregunta: { where: { estado: true } } },
      });
      if (!prueba) throw new AppError('Cuestionario no encontrado o sin acceso', 404, 'CUESTIONARIO_NOT_FOUND');
      if (prueba.tbl_t_pregunta.length === 0) throw new AppError('El cuestionario no tiene preguntas', 400, 'NO_PREGUNTAS');

      let codigoAcceso;
      let intentos = 0;
      while (intentos < 10) {
        const candidato = generateAccessCode();
        const existe = await prisma.tbl_t_partida.findUnique({ where: { codigo_acceso: candidato } });
        if (!existe) {
          codigoAcceso = candidato;
          break;
        }
        intentos++;
      }
      if (!codigoAcceso) throw new AppError('No se pudo generar un código único, intente de nuevo', 500, 'CODIGO_GENERATION_FAILED');

      const partida = await prisma.tbl_t_partida.create({
        data: {
          prueba_id: prueba.id_prueba,
          codigo_acceso: codigoAcceso,
          estado_partida: 'esperando',
          usuario_creacion: profesor.usuario_id,
        },
        include: { tbl_t_prueba: { select: { titulo: true } } },
      });

      logger.info('Partida created', { usuarioId, partidaId: partida.id_partida, codigo_acceso: codigoAcceso });

      return PartidaMapper.toCreatedResponse(partida, prueba.tbl_t_pregunta.length);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating partida', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getResultados(usuarioId, partidaId) {
    logger.info('Fetching resultados for partida', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertPartidaOwnership(partidaId, profesor);
      const resultados = await PartidaRepository.findResultados(partidaId);
      logger.info('Resultados fetched', { usuarioId, partidaId });
      return resultados;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching resultados', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async getRanking(usuarioId, partidaId) {
    logger.info('Fetching ranking for partida', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertPartidaOwnership(partidaId, profesor);

      const participaciones = await prisma.tbl_t_partida_estudiante.findMany({
        where: { partida_id: partidaId, estado: true },
        include: {
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
        orderBy: [{ puntaje_total: 'desc' }, { respuestas_correctas: 'desc' }],
      });

      logger.info('Ranking fetched', { usuarioId, partidaId, totalParticipantes: participaciones.length });

      return PartidaMapper.toRankingResponse(participaciones);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching ranking', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }
}

module.exports = new PartidaService();
