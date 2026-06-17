const catchAsync = require('../utils/catchAsync');
const partidaService = require('../services/partida.service');
const logger = require('../config/logger');

const getHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, prueba_id, profesor_id } = req.query;
  logger.info('Controller: getHistory partidas', { profesor_id, query: req.query });
  const data = await partidaService.getHistory(parseInt(profesor_id, 10), {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    prueba_id: prueba_id ? parseInt(prueba_id, 10) : undefined,
  });
  res.json({ success: true, ...data });
});

const getById = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getById partida', { profesor_id, id: req.params.id });
  const data = await partidaService.getById(parseInt(profesor_id, 10), parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const create = catchAsync(async (req, res) => {
  const { profesor_id } = req.body;
  logger.info('Controller: create partida', { profesor_id, prueba_id: req.body.prueba_id });
  await partidaService.create(parseInt(profesor_id, 10), req.body);
  res.status(201).json({ success: true, message: 'Partida creada' });
});

const getResultados = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getResultados', { profesor_id, id: req.params.id });
  const data = await partidaService.getResultados(parseInt(profesor_id, 10), parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const getRanking = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getRanking', { profesor_id, id: req.params.id });
  const data = await partidaService.getRanking(parseInt(profesor_id, 10), parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

module.exports = { getHistory, getById, create, getResultados, getRanking };
