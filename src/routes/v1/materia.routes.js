const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const materiaController = require('../../controllers/materia.controller');

// Materias asignadas al profesor (con estadísticas)
router.get('/', requireProfesor, materiaController.getMaterias);

// Detalle de una materia asignada
router.get('/:id', requireProfesor, materiaController.getMateriaById);

module.exports = router;
