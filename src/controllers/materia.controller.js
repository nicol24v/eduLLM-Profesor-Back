const catchAsync = require('../utils/catchAsync');
const materiaService = require('../services/materia.service');
const logger = require('../config/logger');

const getMaterias = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getMaterias', { profesor_id });
  const data = await materiaService.getMaterias(parseInt(profesor_id, 10));
  res.json({ success: true, data });
});

const getMateriaById = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getMateriaById', { profesor_id, materiaId: req.params.id });
  const data = await materiaService.getMateriaById(
    parseInt(profesor_id, 10),
    parseInt(req.params.id, 10),
  );
  res.json({ success: true, data });
});

module.exports = { getMaterias, getMateriaById };
