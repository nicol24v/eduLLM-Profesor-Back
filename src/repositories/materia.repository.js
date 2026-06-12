const prisma = require('../config/prisma');

const findByProfesorId = async (profesorId) => {
  return prisma.tbl_t_profesor_materia.findMany({
    where: { profesor_id: profesorId, estado: true },
    include: {
      tbl_m_materia: {
        include: { tbl_m_grado: { select: { grado: true, paralelo: true } } },
      },
      tbl_m_periodo_lectivo: { select: { nombre: true, es_activo: true } },
    },
    orderBy: { fecha_asignacion: 'desc' },
  });
};

module.exports = { findByProfesorId };
