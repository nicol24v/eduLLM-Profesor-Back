const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const dashboardController = require('../../controllers/dashboard.controller');

router.get('/', requireProfesor, dashboardController.getStats);
router.get('/graficas', requireProfesor, dashboardController.getGraficas);
router.get('/analitica', requireProfesor, dashboardController.getAnalitica);

module.exports = router;
