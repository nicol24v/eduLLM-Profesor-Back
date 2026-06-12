'use strict';

const catchAsync = require('../../utils/catchAsync');
const ImportQuizUseCase = require('../../application/usecases/ImportQuizUseCase');

const importQuiz = new ImportQuizUseCase();

const create = catchAsync(async (req, res) => {
  const { pregunta, origen } = req.body;
  const result = await importQuiz.execute({
    pregunta,
    origen,
    usuarioId: req.user.id_usuario,
  });
  res.status(201).json({ success: true, data: result });
});

module.exports = { create };
