const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const dashboardController = require('../../controllers/dashboard.controller');

//Panel principal del docente
router.get('/', requireProfesor, dashboardController.getStats);

//Dashboard con gráficas
router.get('/graficas', requireProfesor, dashboardController.getGraficas);

module.exports = router;
