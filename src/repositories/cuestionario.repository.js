const prisma = require('../config/prisma');

const findByIdWithPreguntas = async (pruebaId) => {
  return prisma.tbl_t_prueba.findFirst({
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
};

module.exports = { findByIdWithPreguntas };
