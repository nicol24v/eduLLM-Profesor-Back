const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const partidaController = require('../../controllers/partida.controller');

// HU15 - Historial de partidas
router.get('/', requireProfesor, partidaController.getHistory);

// HU13 - Crear nueva sesión de quiz (genera código de acceso)
router.post('/', requireProfesor, partidaController.create);

// HU15 - Detalle de una partida
router.get('/:id', requireProfesor, partidaController.getById);

// HU14 - Resultados completos y ranking
router.get('/:id/resultados', requireProfesor, partidaController.getResultados);

// HU14 - Ranking de la partida
router.get('/:id/ranking', requireProfesor, partidaController.getRanking);

module.exports = router;
