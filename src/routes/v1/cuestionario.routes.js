const express = require('express');
const router = express.Router();
const requireProfesor = require('../../middlewares/requireProfesor');
const cuestionarioController = require('../../controllers/cuestionario.controller');
const { sanitizeCuestionario } = require('../../middlewares/sanitize.middleware');

// HU12 - Listar cuestionarios del profesor
router.get('/', requireProfesor, cuestionarioController.getAll);

// HU10 - Crear cuestionario manual
router.post('/', requireProfesor, sanitizeCuestionario, cuestionarioController.create);

// HU12 - Obtener detalle de un cuestionario
router.get('/:id', requireProfesor, cuestionarioController.getById);

// HU12 - Editar cuestionario
router.put('/:id', requireProfesor, sanitizeCuestionario, cuestionarioController.update);

// HU12 - Eliminar cuestionario (soft delete)
router.delete('/:id', requireProfesor, cuestionarioController.remove);

module.exports = router;
