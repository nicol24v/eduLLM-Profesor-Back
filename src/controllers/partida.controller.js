const catchAsync = require('../utils/catchAsync');
const partidaService = require('../services/partida.service');
const logger = require('../config/logger');

const getHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, prueba_id } = req.query;
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getHistory partidas', { usuarioId, query: req.query });
  const perPage = Math.min(parseInt(limit, 10) || 10, 100);
  const data = await partidaService.getHistory(usuarioId, {
    page: parseInt(page, 10) || 1,
    limit: perPage,
    prueba_id: prueba_id ? parseInt(prueba_id, 10) : undefined,
  });
  res.json({ success: true, ...data });
});

const getById = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getById partida', { usuarioId, id: req.params.id });
  const data = await partidaService.getById(usuarioId, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const create = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: create partida', { usuarioId, prueba_id: req.body.prueba_id });
  const partida = await partidaService.create(usuarioId, req.body);
  res.status(201).json({ success: true, data: partida });
});

const getResultados = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getResultados', { usuarioId, id: req.params.id });
  const data = await partidaService.getResultados(usuarioId, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const getRanking = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getRanking', { usuarioId, id: req.params.id });
  const data = await partidaService.getRanking(usuarioId, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

module.exports = { getHistory, getById, create, getResultados, getRanking };
