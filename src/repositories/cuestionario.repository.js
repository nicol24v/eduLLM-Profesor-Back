const prisma = require('../config/prisma');
const logger = require('../config/logger');

class CuestionarioRepository {
  async findByIdWithPreguntas(pruebaId) {
    logger.debug('Finding cuestionario by id', { pruebaId });
    try {
      const result = await prisma.tbl_t_prueba.findFirst({
        where: { id_prueba: pruebaId, estado: true },
        include: {
          tbl_t_profesor_materia: {
            include: {
              tbl_m_materia: { select: { id_materia: true, nombre: true } },
              tbl_m_periodo_lectivo: { select: { nombre: true, es_activo: true } },
            },
          },
          tbl_t_pregunta: {
            where: { estado: true },
            orderBy: { id_pregunta: 'asc' },
            include: {
              tbl_t_opcion: {
                where: { estado: true },
                orderBy: { orden: 'asc' },
              },
            },
          },
          _count: {
            select: { tbl_t_partida: { where: { estado: true } } },
          },
        },
      });
      logger.debug('Cuestionario found', { pruebaId, found: !!result });
      return result;
    } catch (error) {
      logger.error('Error finding cuestionario by id', { pruebaId, error: error.message });
      throw error;
    }
  }

  async findProfesorMateriasIds(profesorId, materiaId) {
    const where = { profesor_id: profesorId, estado: true };
    if (materiaId) where.materia_id = materiaId;
    const rows = await prisma.tbl_t_profesor_materia.findMany({
      where,
      select: { id_profesor_materia: true },
    });
    return rows.map((r) => r.id_profesor_materia);
  }

  async countByMateriaIds(profesorMateriaIds) {
    return prisma.tbl_t_prueba.count({
      where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
    });
  }

  async findPaginated(profesorMateriaIds, skip, limit) {
    return prisma.tbl_t_prueba.findMany({
      where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
      include: {
        tbl_t_profesor_materia: {
          include: { tbl_m_materia: { select: { nombre: true } } },
        },
        _count: { select: { tbl_t_pregunta: { where: { estado: true } } } },
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: limit,
    });
  }

  async findPruebaForGame(pruebaId) {
    return prisma.tbl_t_prueba.findFirst({
      where: { id_prueba: parseInt(pruebaId, 10), estado: true },
      include: {
        tbl_t_pregunta: {
          where: { estado: true },
          include: { tbl_t_opcion: { where: { estado: true } } },
        },
      },
    });
  }
}

module.exports = new CuestionarioRepository();
