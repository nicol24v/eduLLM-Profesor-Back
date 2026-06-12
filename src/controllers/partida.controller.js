const catchAsync = require('../utils/catchAsync');
const partidaService = require('../services/partida.service');

const getHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, prueba_id } = req.query;
  const data = await partidaService.getHistory(req.user.id_usuario, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    prueba_id: prueba_id ? parseInt(prueba_id, 10) : undefined,
  });
  res.json({ success: true, ...data });
});

const getById = catchAsync(async (req, res) => {
  const data = await partidaService.getById(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const create = catchAsync(async (req, res) => {
  const data = await partidaService.create(req.user.id_usuario, req.body);
  res.status(201).json({ success: true, data });
});

const getResultados = catchAsync(async (req, res) => {
  const data = await partidaService.getResultados(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const getRanking = catchAsync(async (req, res) => {
  const data = await partidaService.getRanking(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

module.exports = { getHistory, getById, create, getResultados, getRanking };
