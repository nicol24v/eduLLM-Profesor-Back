'use strict';

const catchAsync = require('../../utils/catchAsync');
const ImportQuizUseCase = require('../../application/usecases/ImportQuizUseCase');
const logger = require('../../config/logger');

const importQuiz = new ImportQuizUseCase();

const create = catchAsync(async (req, res) => {
  const { origen, ...quizData } = req.body;
  logger.info('Controller: import quiz', { userId: req.user?.id_usuario, origen, subject: quizData.subject });
  const result = await importQuiz.execute({
    pregunta: quizData,
    origen,
    usuarioId: req.user.id_usuario,
  });
  res.status(201).json({ success: true, message: 'Preguntas importadas' });
});

module.exports = { create };
