const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const cuestionarioController = require('../../controllers/cuestionario.controller');
const { sanitizeCuestionario } = require('../../middlewares/sanitize.middleware');

//Listar cuestionarios del profesor
router.get('/', requireProfesor, cuestionarioController.getAll);

//Crear cuestionario manual
router.post('/', requireProfesor, sanitizeCuestionario, cuestionarioController.create);

// Obtener detalle de un cuestionario
router.get('/:id', requireProfesor, cuestionarioController.getById);

//Editar cuestionario
router.put('/:id', requireProfesor, sanitizeCuestionario, cuestionarioController.update);

//Eliminar cuestionario (soft delete)
router.delete('/:id', requireProfesor, cuestionarioController.remove);

module.exports = router;
