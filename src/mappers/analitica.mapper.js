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

function getNombre(pe) {
  const usuario = pe.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
  return usuario
    ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
    : pe.nickname_opcional || 'Anónimo';
}

class AnaliticaMapper {
  static toAnaliticaResponse({ partidas, respuestas, pruebaTituloMap }) {
    return {
      evolucion: this._buildEvolucion(partidas),
      ranking: this._buildRanking(partidas),
      heatmap: this._buildHeatmap(partidas),
      debilidades: this._buildDebilidades(respuestas, pruebaTituloMap),
    };
  }

  static _buildEvolucion(partidas) {
    return partidas.map((p) => {
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
  }

  static _buildRanking(partidas) {
    const porEstudiante = {};
    for (const p of partidas) {
      const totalPreguntas = p.tbl_t_prueba._count.tbl_t_pregunta;
      for (const pe of p.tbl_t_partida_estudiante) {
        const nombre = getNombre(pe);
        if (!porEstudiante[nombre]) porEstudiante[nombre] = { total: 0, count: 0 };
        porEstudiante[nombre].total += calcNota(pe.puntaje_total || 0, totalPreguntas);
        porEstudiante[nombre].count += 1;
      }
    }
    return Object.entries(porEstudiante)
      .map(([nombre, d]) => {
        const nota = Math.round((d.total / d.count) * 100) / 100;
        return { nombre, nota_promedio: nota, nivel_loei: nivelLoei(nota), partidas_jugadas: d.count };
      })
      .sort((a, b) => b.nota_promedio - a.nota_promedio);
  }

  static _buildHeatmap(partidas) {
    // Columns: unique quizzes (prueba), ordered by first appearance
    const quizOrder = [];
    const quizMap = {};
    for (const p of partidas) {
      if (!quizMap[p.prueba_id]) {
        quizOrder.push(p.prueba_id);
        quizMap[p.prueba_id] = p.tbl_t_prueba.titulo;
      }
    }

    // Rows: students. For each student+quiz, collect all notas across partidas
    const porEstudianteQuiz = {};
    for (const p of partidas) {
      const totalPreguntas = p.tbl_t_prueba._count.tbl_t_pregunta;
      for (const pe of p.tbl_t_partida_estudiante) {
        const nombre = getNombre(pe);
        if (!porEstudianteQuiz[nombre]) porEstudianteQuiz[nombre] = {};
        if (!porEstudianteQuiz[nombre][p.prueba_id]) porEstudianteQuiz[nombre][p.prueba_id] = [];
        porEstudianteQuiz[nombre][p.prueba_id].push(calcNota(pe.puntaje_total || 0, totalPreguntas));
      }
    }

    const filas = Object.entries(porEstudianteQuiz).map(([nombre, quizNotas]) => ({
      estudiante: nombre,
      valores: quizOrder.map((pruebaId) => {
        const notas = quizNotas[pruebaId];
        if (!notas?.length) return null;
        const avg = notas.reduce((a, b) => a + b, 0) / notas.length;
        return Math.round(avg * 100) / 100;
      }),
    }));

    return {
      quizzes: quizOrder.map((id) => quizMap[id]),
      filas,
    };
  }

  static _buildDebilidades(respuestas, pruebaTituloMap) {
    const porPregunta = {};
    for (const r of respuestas) {
      const pregId = r.pregunta_id;
      if (!porPregunta[pregId]) {
        porPregunta[pregId] = {
          texto: r.tbl_t_pregunta.texto,
          pruebaId: r.tbl_t_pregunta.prueba_id,
          total: 0,
          errores: 0,
        };
      }
      porPregunta[pregId].total += 1;
      if (!r.tbl_t_opcion?.es_correcta) {
        porPregunta[pregId].errores += 1;
      }
    }

    return Object.values(porPregunta)
      .filter((p) => p.total > 0)
      .map((p) => ({
        pregunta: p.texto,
        quiz: pruebaTituloMap[p.pruebaId] ?? 'Quiz',
        tasa_error: Math.round((p.errores / p.total) * 100),
        total_respuestas: p.total,
      }))
      .sort((a, b) => b.tasa_error - a.tasa_error)
      .slice(0, 15);
  }
}

module.exports = AnaliticaMapper;
