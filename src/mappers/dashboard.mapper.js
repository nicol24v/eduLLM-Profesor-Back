const PartidaMapper = require('./partida.mapper');

class DashboardMapper {
  static toStatsResponse({
    totalEstudiantes,
    totalCuestionarios,
    totalMaterias,
    partidasPendientes,
    materias,
  }) {
    return {
      total_estudiantes: totalEstudiantes,
      total_cuestionarios: totalCuestionarios,
      total_materias: totalMaterias,
      partidas_pendientes: partidasPendientes.map((p) =>
        PartidaMapper.toDashboardPendienteResponse(p),
      ),
      materias: materias.map((pm) => ({
        id_profesor_materia: pm.id_profesor_materia,
        materia: pm.tbl_m_materia?.nombre,
        periodo: pm.tbl_m_periodo_lectivo?.nombre,
        es_activo: pm.tbl_m_periodo_lectivo?.es_activo,
      })),
    };
  }

  static toGraficasResponse({ barraHorizontal, barraVertical, distribucion }) {
    return {
      barra_horizontal: barraHorizontal,
      barra_vertical: barraVertical,
      distribucion_puntajes: Object.entries(distribucion).map(([rango, cantidad]) => ({
        rango,
        cantidad,
      })),
    };
  }
}

module.exports = DashboardMapper;
