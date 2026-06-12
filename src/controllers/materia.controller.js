const catchAsync = require('../utils/catchAsync');
const materiaService = require('../services/materia.service');

const getMaterias = catchAsync(async (req, res) => {
  const data = await materiaService.getMaterias(req.user.id_usuario);
  res.json({ success: true, data });
});

const getMateriaById = catchAsync(async (req, res) => {
  const data = await materiaService.getMateriaById(
    req.user.id_usuario,
    parseInt(req.params.id, 10),
  );
  res.json({ success: true, data });
});

module.exports = { getMaterias, getMateriaById };
