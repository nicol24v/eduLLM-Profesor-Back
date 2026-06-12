const catchAsync = require('../utils/catchAsync');
const dashboardService = require('../services/dashboard.service');

const getStats = catchAsync(async (req, res) => {
  const data = await dashboardService.getDashboardStats(req.user.id_usuario);
  res.json({ success: true, data });
});

const getGraficas = catchAsync(async (req, res) => {
  const data = await dashboardService.getGraficas(req.user.id_usuario);
  res.json({ success: true, data });
});

module.exports = { getStats, getGraficas };
