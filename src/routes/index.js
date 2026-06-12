const express = require('express');
const router = express.Router();

const dashboardRoutes = require('./v1/dashboard.routes');
const cuestionarioRoutes = require('./v1/cuestionario.routes');
const partidaRoutes = require('./v1/partida.routes');
const materiaRoutes = require('./v1/materia.routes');

router.use('/dashboard', dashboardRoutes);
router.use('/cuestionarios', cuestionarioRoutes);
router.use('/partidas', partidaRoutes);
router.use('/materias', materiaRoutes);

module.exports = router;
