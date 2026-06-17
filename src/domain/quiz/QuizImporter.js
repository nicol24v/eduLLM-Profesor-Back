'use strict';

/**
 * Transforms a MindBuzz-format JSON into the DB entity structure
 * expected by Prisma (tbl_t_prueba / tbl_t_pregunta / tbl_t_opcion).
 */
class QuizImporter {
  /**
   * @param {object} mindbuzzJson  Validated MindBuzz JSON
   * @param {object} meta          { origen, usuarioId, profesorMateriaId }
   * @returns {{ pruebaData, preguntasData }}
   */
  transform(mindbuzzJson, meta) {
    const { subject, questions } = mindbuzzJson;
    const { origen, usuarioId, profesorMateriaId } = meta;

    const pruebaData = {
      titulo: subject.trim(),
      configuracion: {
        origen,
        json_original: mindbuzzJson,
        fecha_importacion: new Date().toISOString(),
        importado_por: usuarioId,
      },
      profesor_materia_id: profesorMateriaId,
      usuario_creacion: usuarioId,
    };

    const preguntasData = questions.map((q) => {
      const correctIdx = q.solutions[0];
      const opciones = q.options.map((texto, idx) => ({
        texto,
        orden: idx + 1,
        es_correcta: idx === correctIdx,
        usuario_creacion: usuarioId,
      }));

      return {
        texto: q.question.trim(),
        tipo: 'single_choice',
        tiempo_limite: q.time,
        cooldown: typeof q.cooldown === 'number' ? q.cooldown : 5,
        image_url: q.image || null,
        usuario_creacion: usuarioId,
        opciones,
      };
    });

    return { pruebaData, preguntasData };
  }
}

module.exports = QuizImporter;
