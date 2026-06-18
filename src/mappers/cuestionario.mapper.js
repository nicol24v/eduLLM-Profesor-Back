class CuestionarioMapper {
  static toResponse(prueba) {
    if (!prueba) return null;
    return {
      id_prueba: prueba.id_prueba,
      titulo: prueba.titulo,
      descripcion: prueba.descripcion,
      materia: prueba.tbl_t_profesor_materia?.tbl_m_materia?.nombre || null,
      total_preguntas: prueba._count?.tbl_t_pregunta ?? 0,
      configuracion: prueba.configuracion,
      fecha_creacion: prueba.fecha_creacion,
    };
  }

  static toListResponse(cuestionarios, meta) {
    return {
      data: cuestionarios.map((c) => this.toResponse(c)),
      meta,
    };
  }

  static toDetailResponse(prueba) {
    if (!prueba) return null;
    return {
      id_prueba: prueba.id_prueba,
      titulo: prueba.titulo,
      descripcion: prueba.descripcion,
      profesor_materia_id: prueba.profesor_materia_id,
      configuracion: prueba.configuracion,
      tbl_t_profesor_materia: prueba.tbl_t_profesor_materia
        ? {
            id_profesor_materia: prueba.tbl_t_profesor_materia.id_profesor_materia,
            tbl_m_materia: prueba.tbl_t_profesor_materia.tbl_m_materia,
            tbl_m_periodo_lectivo: prueba.tbl_t_profesor_materia.tbl_m_periodo_lectivo,
          }
        : null,
      tbl_t_pregunta: (prueba.tbl_t_pregunta || []).map((p) => ({
        id_pregunta: p.id_pregunta,
        texto: p.texto,
        tipo: p.tipo,
        tiempo_limite: p.tiempo_limite,
        cooldown: p.cooldown,
        image_url: p.image_url,
        audio_url: p.audio_url,
        video_url: p.video_url,
        tbl_t_opcion: (p.tbl_t_opcion || []).map((o) => ({
          id_opcion: o.id_opcion,
          texto: o.texto,
          orden: o.orden,
          es_correcta: o.es_correcta,
        })),
      })),
      _count: prueba._count,
    };
  }

  static toCreatedResponse(prueba) {
    if (!prueba) return null;
    return {
      id_prueba: prueba.id_prueba,
      titulo: prueba.titulo,
      total_preguntas: prueba.tbl_t_pregunta?.length || 0,
      fecha_creacion: prueba.fecha_creacion,
    };
  }
}

module.exports = CuestionarioMapper;
