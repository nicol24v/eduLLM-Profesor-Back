const catchAsync = require('../utils/catchAsync');
const dashboardService = require('../services/dashboard.service');
const logger = require('../config/logger');

const getStats = catchAsync(async (req, res) => {
  const usuarioId = parseInt(req.query.profesor_id, 10);
  logger.info('Controller: getDashboardStats', { usuarioId });
  const data = await dashboardService.getDashboardStats(usuarioId);
  res.json({ success: true, data });
});

const getGraficas = catchAsync(async (req, res) => {
  const usuarioId = parseInt(req.query.profesor_id, 10);
  logger.info('Controller: getDashboardGraficas', { usuarioId });
  const data = await dashboardService.getGraficas(usuarioId);
  res.json({ success: true, data });
});

module.exports = { getStats, getGraficas };
