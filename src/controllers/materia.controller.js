const catchAsync = require('../utils/catchAsync');
const materiaService = require('../services/materia.service');
const logger = require('../config/logger');

const getMaterias = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getMaterias', { usuarioId });
  const data = await materiaService.getMaterias(usuarioId);
  res.json({ success: true, data });
});

const getMateriaById = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getMateriaById', { usuarioId, materiaId: req.params.id });
  const data = await materiaService.getMateriaById(
    usuarioId,
    parseInt(req.params.id, 10),
  );
  res.json({ success: true, data });
});

module.exports = { getMaterias, getMateriaById };
