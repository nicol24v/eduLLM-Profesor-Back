const catchAsync = require('../utils/catchAsync');
const dashboardService = require('../services/dashboard.service');
const logger = require('../config/logger');

const getStats = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getDashboardStats', { profesor_id });
  const data = await dashboardService.getDashboardStats(parseInt(profesor_id, 10));
  res.json({ success: true, data });
});

const getGraficas = catchAsync(async (req, res) => {
  const { profesor_id } = req.query;
  logger.info('Controller: getDashboardGraficas', { profesor_id });
  const data = await dashboardService.getGraficas(parseInt(profesor_id, 10));
  res.json({ success: true, data });
});

module.exports = { getStats, getGraficas };
