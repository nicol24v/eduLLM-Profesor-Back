const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const MateriaRepository = require('../repositories/materia.repository');
const MateriaMapper = require('../mappers/materia.mapper');

class MateriaService {
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

  async getMaterias(usuarioId) {
    logger.info('Fetching materias for user', { usuarioId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMaterias = await MateriaRepository.findByProfesorId(profesor.id_profesor);

      const result = await Promise.all(
        profesorMaterias.map(async (pm) => {
          const totalEstudiantes = await prisma.tbl_m_estudiante_materia.count({
            where: { id_materia: pm.materia_id, estado: true },
          });
          const totalCuestionarios = await prisma.tbl_t_prueba.count({
            where: { profesor_materia_id: pm.id_profesor_materia, estado: true },
          });
          return MateriaMapper.toResponseWithCounts(pm, totalEstudiantes, totalCuestionarios);
        }),
      );

      logger.info('Materias fetched successfully', { usuarioId, count: result.length });
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching materias', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getMateriaById(usuarioId, profesorMateriaId) {
    logger.info('Fetching materia by id', { usuarioId, profesorMateriaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const pm = await prisma.tbl_t_profesor_materia.findFirst({
        where: {
          id_profesor_materia: profesorMateriaId,
          profesor_id: profesor.id_profesor,
          estado: true,
        },
        include: {
          tbl_m_materia: {
            include: { tbl_m_grado: { select: { grado: true, paralelo: true } } },
          },
          tbl_m_periodo_lectivo: true,
        },
      });

      if (!pm) {
        logger.warn('Materia not found or no access', { usuarioId, profesorMateriaId });
        throw new AppError('Materia no encontrada o sin acceso', 404, 'MATERIA_NOT_FOUND');
      }

      const estudiantes = await prisma.tbl_m_estudiante_materia.findMany({
        where: { id_materia: pm.materia_id, estado: true },
        include: {
          tbl_m_estudiante: {
            include: {
              tbl_m_usuario: {
                select: { primer_nombre: true, segundo_nombre: true, apellido_paterno: true, correo: true },
              },
            },
          },
        },
      });

      logger.info('Materia fetched successfully', { usuarioId, profesorMateriaId, estudiantesCount: estudiantes.length });
      return MateriaMapper.toDetailResponse(pm, estudiantes);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching materia by id', { usuarioId, profesorMateriaId, error: error.message });
      throw error;
    }
  }
}

module.exports = new MateriaService();
