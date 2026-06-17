const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const partidaController = require('../../controllers/partida.controller');

//Historial de partidas
router.get('/', requireProfesor, partidaController.getHistory);

//Crear nueva sesión de quiz (genera código de acceso)
router.post('/', requireProfesor, partidaController.create);

// Detalle de una partida
router.get('/:id', requireProfesor, partidaController.getById);

//Resultados completos y ranking
router.get('/:id/resultados', requireProfesor, partidaController.getResultados);

//Ranking de la partida
router.get('/:id/ranking', requireProfesor, partidaController.getRanking);

module.exports = router;
