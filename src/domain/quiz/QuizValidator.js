'use strict';

const AppError = require('../../utils/AppError');

class QuizValidator {
  validate(mindbuzzJson) {
    const { subject, questions } = mindbuzzJson;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      throw new AppError('El campo "subject" es requerido', 400);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new AppError('El cuestionario debe tener al menos 1 pregunta', 400);
    }

    for (const [i, q] of questions.entries()) {
      const num = i + 1;

      if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
        throw new AppError(`La pregunta ${num} no tiene texto`, 400);
      }

      if (!Array.isArray(q.answers) || q.answers.length < 2) {
        throw new AppError(`La pregunta ${num} debe tener al menos 2 respuestas`, 400);
      }

      if (!Array.isArray(q.solutions) || q.solutions.length !== 1) {
        throw new AppError(`La pregunta ${num} debe tener exactamente 1 respuesta correcta`, 400);
      }

      const solutionIdx = q.solutions[0];
      if (typeof solutionIdx !== 'number' || solutionIdx < 0 || solutionIdx >= q.answers.length) {
        throw new AppError(`El índice de solución de la pregunta ${num} es inválido`, 400);
      }

      if (typeof q.time !== 'number' || q.time <= 0) {
        throw new AppError(`La pregunta ${num} debe tener un tiempo límite válido`, 400);
      }
    }
  }
}

module.exports = QuizValidator;
