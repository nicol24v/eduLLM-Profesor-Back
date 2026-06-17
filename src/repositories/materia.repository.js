const prisma = require('../config/prisma');
const logger = require('../config/logger');

class MateriaRepository {
  async findByProfesorId(profesorId) {
    logger.debug('Finding materias by profesorId', { profesorId });
    try {
      const result = await prisma.tbl_t_profesor_materia.findMany({
        where: { profesor_id: profesorId, estado: true },
        include: {
          tbl_m_materia: {
            include: { tbl_m_grado: { select: { grado: true, paralelo: true } } },
          },
          tbl_m_periodo_lectivo: { select: { nombre: true, es_activo: true } },
        },
        orderBy: { fecha_asignacion: 'desc' },
      });
      logger.debug('Materias found', { profesorId, count: result.length });
      return result;
    } catch (error) {
      logger.error('Error finding materias by profesorId', { profesorId, error: error.message });
      throw error;
    }
  }

  async findProfesorMateriaActiva(profesorId, materiaId) {
    logger.debug('Finding active profesor_materia', { profesorId, materiaId });
    try {
      return await prisma.tbl_t_profesor_materia.findFirst({
        where: {
          profesor_id: profesorId,
          materia_id: parseInt(materiaId, 10),
          estado: true,
          tbl_m_periodo_lectivo: { es_activo: true },
        },
        include: {
          tbl_m_materia: true,
          tbl_m_periodo_lectivo: true,
        },
      });
    } catch (error) {
      logger.error('Error finding active profesor_materia', { profesorId, materiaId, error: error.message });
      throw error;
    }
  }
}

module.exports = new MateriaRepository();
