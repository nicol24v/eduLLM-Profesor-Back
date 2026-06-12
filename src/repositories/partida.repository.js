const prisma = require('../config/prisma');

const findResultados = async (partidaId) => {
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

  if (!partida) return null;

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
};

module.exports = { findResultados };
