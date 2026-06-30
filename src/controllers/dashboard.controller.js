const catchAsync = require('../utils/catchAsync');
const dashboardService = require('../services/dashboard.service');
const analiticaService = require('../services/analitica.service');
const logger = require('../config/logger');

const getStats = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getDashboardStats', { usuarioId });
  const data = await dashboardService.getDashboardStats(usuarioId);
  res.json({ success: true, data });
});

const getGraficas = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getDashboardGraficas', { usuarioId });
  const data = await dashboardService.getGraficas(usuarioId);
  res.json({ success: true, data });
});

const getAnalitica = catchAsync(async (req, res) => {
  const usuarioId = req.user.id_usuario;
  logger.info('Controller: getAnalitica', { usuarioId });
  const data = await analiticaService.getAnalitica(usuarioId);
  res.json({ success: true, data });
});

module.exports = { getStats, getGraficas, getAnalitica };
