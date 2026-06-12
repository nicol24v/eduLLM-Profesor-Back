const catchAsync = require('../utils/catchAsync');
const cuestionarioService = require('../services/cuestionario.service');

const getAll = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, materia_id } = req.query;
  const data = await cuestionarioService.getAll(req.user.id_usuario, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    materia_id: materia_id ? parseInt(materia_id, 10) : undefined,
  });
  res.json({ success: true, ...data });
});

const getById = catchAsync(async (req, res) => {
  const data = await cuestionarioService.getById(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const create = catchAsync(async (req, res) => {
  const data = await cuestionarioService.create(req.user.id_usuario, req.body);
  res.status(201).json({ success: true, data });
});

const update = catchAsync(async (req, res) => {
  const data = await cuestionarioService.update(
    req.user.id_usuario,
    parseInt(req.params.id, 10),
    req.body,
  );
  res.json({ success: true, data });
});

const remove = catchAsync(async (req, res) => {
  await cuestionarioService.remove(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, message: 'Cuestionario eliminado' });
});

module.exports = { getAll, getById, create, update, remove };
