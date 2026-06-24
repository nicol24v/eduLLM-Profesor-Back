const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const partidaController = require('../../controllers/partida.controller');

//Historial de partidas
router.get('/', requireProfesor, partidaController.getHistory);

//Crear nueva sesión de quiz (genera código de acceso)
router.post('/', requireProfesor, partidaController.create);

//Buscar partida por código de acceso
router.get('/codigo/:codigoAcceso', requireProfesor, partidaController.getByCodigo);

//Avanzar a siguiente pregunta
router.put('/:id/siguiente-pregunta', requireProfesor, partidaController.siguientePregunta);

//Finalizar una partida
router.put('/:id/finalizar', requireProfesor, partidaController.finalizar);

// Detalle de una partida
router.get('/:id', requireProfesor, partidaController.getById);

//Resultados completos y ranking
router.get('/:id/resultados', requireProfesor, partidaController.getResultados);

//Ranking de la partida
router.get('/:id/ranking', requireProfesor, partidaController.getRanking);

//Iniciar una partida (cambia estado a "en_curso")
router.put('/:id/iniciar', requireProfesor, partidaController.iniciar);

module.exports = router;
