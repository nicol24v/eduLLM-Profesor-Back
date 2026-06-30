const MAX_PTS_POR_PREGUNTA = 1000;

function calcNota(puntajeTotal, totalPreguntas) {
  if (totalPreguntas === 0) return 1.0;
  const raw = (puntajeTotal / (totalPreguntas * MAX_PTS_POR_PREGUNTA)) * 10;
  return Math.min(10, Math.max(1, Math.round(raw * 100) / 100));
}

function nivelLoei(nota) {
  if (nota >= 9) return 'SAR';
  if (nota >= 8) return 'DAR';
  if (nota >= 7) return 'AAR';
  if (nota >= 5) return 'PAAR';
  return 'NAAR';
}

class AnaliticaMapper {
  static toAnaliticaResponse({ partidas }) {
    const evolucion = partidas.map((p) => {
      const totalPreguntas = p.tbl_t_prueba._count.tbl_t_pregunta;
      const notas = p.tbl_t_partida_estudiante.map(
        (pe) => calcNota(pe.puntaje_total || 0, totalPreguntas),
      );
      const promedio =
        notas.length > 0
          ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100
          : 0;
      return {
        fecha: p.fecha_creacion.toISOString().split('T')[0],
        promedio_nota: promedio,
        total_participantes: notas.length,
      };
    });

    const porEstudiante = {};
    for (const p of partidas) {
      const totalPreguntas = p.tbl_t_prueba._count.tbl_t_pregunta;
      for (const pe of p.tbl_t_partida_estudiante) {
        const usuario = pe.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
        const nombre = usuario
          ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
          : pe.nickname_opcional || 'Anónimo';
        if (!porEstudiante[nombre]) porEstudiante[nombre] = { total: 0, count: 0 };
        porEstudiante[nombre].total += calcNota(pe.puntaje_total || 0, totalPreguntas);
        porEstudiante[nombre].count += 1;
      }
    }

    const ranking = Object.entries(porEstudiante)
      .map(([nombre, d]) => {
        const nota = Math.round((d.total / d.count) * 100) / 100;
        return {
          nombre,
          nota_promedio: nota,
          nivel_loei: nivelLoei(nota),
          partidas_jugadas: d.count,
        };
      })
      .sort((a, b) => b.nota_promedio - a.nota_promedio);

    return { evolucion, ranking };
  }
}

module.exports = AnaliticaMapper;
