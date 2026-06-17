const prisma = require('../config/prisma');
const logger = require('../config/logger');

class PartidaRepository {
  async findResultados(partidaId) {
    logger.debug('Finding resultados for partida', { partidaId });
    try {
      const partida = await prisma.tbl_t_partida.findUnique({
        where: { id_partida: partidaId },
        include: {
          tbl_t_prueba: {
            include: {
              tbl_t_pregunta: {
                where: { estado: true },
                orderBy: { id_pregunta: 'asc' },
                include: {
                  tbl_t_opcion: { where: { estado: true }, orderBy: { orden: 'asc' } },
                },
              },
            },
          },
          tbl_t_partida_estudiante: {
            where: { estado: true },
            orderBy: [{ puntaje_total: 'desc' }, { respuestas_correctas: 'desc' }],
            include: {
              tbl_m_estudiante_materia: {
                include: {
                  tbl_m_estudiante: {
                    include: {
                      tbl_m_usuario: {
                        select: { primer_nombre: true, apellido_paterno: true },
                      },
                    },
                  },
                },
              },
              tbl_t_respuesta: {
                where: { estado: true },
                include: {
                  tbl_t_opcion: { select: { texto: true, es_correcta: true } },
                  tbl_t_pregunta: { select: { texto: true } },
                },
              },
            },
          },
        },
      });

      if (!partida) {
        logger.debug('Partida not found for resultados', { partidaId });
        return null;
      }

      const participaciones = partida.tbl_t_partida_estudiante.map((pe, idx) => {
        const usuario = pe.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
        const nombre = usuario
          ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
          : pe.nickname_opcional || 'Anónimo';

        return {
          posicion: idx + 1,
          id_partida_estudiante: pe.id_partida_estudiante,
          nombre,
          puntaje_total: pe.puntaje_total,
          respuestas_correctas: pe.respuestas_correctas,
          respuestas: pe.tbl_t_respuesta.map((r) => ({
            pregunta: r.tbl_t_pregunta.texto,
            opcion_elegida: r.tbl_t_opcion?.texto || null,
            fue_correcta: r.tbl_t_opcion?.es_correcta ?? false,
            puntaje_obtenido: r.puntaje_obtenido,
            tiempo_ms: r.tiempo_ms,
          })),
        };
      });

      logger.debug('Resultados found', { partidaId, totalParticipantes: participaciones.length });

      return {
        id_partida: partida.id_partida,
        codigo_acceso: partida.codigo_acceso,
        estado_partida: partida.estado_partida,
        prueba: {
          titulo: partida.tbl_t_prueba.titulo,
          total_preguntas: partida.tbl_t_prueba.tbl_t_pregunta.length,
        },
        total_participantes: participaciones.length,
        iniciado_en: partida.iniciado_en,
        finalizado_en: partida.finalizado_en,
        participaciones,
      };
    } catch (error) {
      logger.error('Error finding resultados for partida', { partidaId, error: error.message });
      throw error;
    }
  }

  async findProfesorMateriaIds(profesorId) {
    const rows = await prisma.tbl_t_profesor_materia.findMany({
      where: { profesor_id: profesorId, estado: true },
      select: { id_profesor_materia: true },
    });
    return rows.map((r) => r.id_profesor_materia);
  }

  async findPruebaIdsByMateriaIds(profesorMateriaIds, pruebaId) {
    const where = { profesor_materia_id: { in: profesorMateriaIds }, estado: true };
    if (pruebaId) where.id_prueba = pruebaId;
    const rows = await prisma.tbl_t_prueba.findMany({
      where,
      select: { id_prueba: true },
    });
    return rows.map((r) => r.id_prueba);
  }

  async countByPruebaIds(pruebaIds) {
    return prisma.tbl_t_partida.count({
      where: { prueba_id: { in: pruebaIds }, estado: true },
    });
  }

  async findPaginated(pruebaIds, skip, limit) {
    return prisma.tbl_t_partida.findMany({
      where: { prueba_id: { in: pruebaIds }, estado: true },
      include: {
        tbl_t_prueba: { select: { titulo: true } },
        _count: { select: { tbl_t_partida_estudiante: { where: { estado: true } } } },
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: limit,
    });
  }

  async findActiveProfesorMateria(profesorId, materiaId) {
    return prisma.tbl_t_profesor_materia.findFirst({
      where: {
        profesor_id: profesorId,
        materia_id: parseInt(materiaId, 10),
        estado: true,
        tbl_m_periodo_lectivo: { es_activo: true },
      },
    });
  }
}

module.exports = new PartidaRepository();
