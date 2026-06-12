'use strict';

const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const preguntasController = require('../../presentation/controllers/PreguntasController');

router.post('/', requireProfesor, preguntasController.create);

module.exports = router;
