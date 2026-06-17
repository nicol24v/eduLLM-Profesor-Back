class PartidaMapper {
  static toHistoryResponse(partida) {
    if (!partida) return null;
    return {
      id_partida: partida.id_partida,
      codigo_acceso: partida.codigo_acceso,
      estado_partida: partida.estado_partida,
      titulo_prueba: partida.tbl_t_prueba?.titulo,
      total_participantes: partida._count?.tbl_t_partida_estudiante ?? 0,
      iniciado_en: partida.iniciado_en,
      finalizado_en: partida.finalizado_en,
      fecha_creacion: partida.fecha_creacion,
    };
  }

  static toHistoryListResponse(partidas, meta) {
    return {
      data: partidas.map((p) => this.toHistoryResponse(p)),
      meta,
    };
  }

  static toCreatedResponse(partida, totalPreguntas) {
    return {
      id_partida: partida.id_partida,
      codigo_acceso: partida.codigo_acceso,
      estado_partida: partida.estado_partida,
      titulo_prueba: partida.tbl_t_prueba?.titulo,
      total_preguntas,
      fecha_creacion: partida.fecha_creacion,
    };
  }

  static toRankingResponse(participaciones) {
    return participaciones.map((p, idx) => {
      const usuario = p.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
      return {
        posicion: idx + 1,
        id_partida_estudiante: p.id_partida_estudiante,
        nombre: usuario
          ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
          : p.nickname_opcional || 'Anónimo',
        puntaje_total: p.puntaje_total,
        respuestas_correctas: p.respuestas_correctas,
      };
    });
  }

  static toDashboardPendienteResponse(partida) {
    return {
      id_partida: partida.id_partida,
      codigo_acceso: partida.codigo_acceso,
      estado_partida: partida.estado_partida,
      titulo_prueba: partida.tbl_t_prueba?.titulo,
      fecha_creacion: partida.fecha_creacion,
    };
  }
}

module.exports = PartidaMapper;
