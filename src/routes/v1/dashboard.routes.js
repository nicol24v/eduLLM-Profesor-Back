const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const dashboardController = require('../../controllers/dashboard.controller');

// HU9 - Panel principal del docente
router.get('/', requireProfesor, dashboardController.getStats);

// HU16 - Dashboard con gráficas
router.get('/graficas', requireProfesor, dashboardController.getGraficas);

module.exports = router;
