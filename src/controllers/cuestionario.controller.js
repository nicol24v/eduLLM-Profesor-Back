const catchAsync = require('../utils/catchAsync');
const cuestionarioService = require('../services/cuestionario.service');
const logger = require('../config/logger');

const getAll = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, materia_id } = req.query;
  logger.info('Controller: getAll cuestionarios', { usuarioId: req.user?.id_usuario, query: req.query });
  const data = await cuestionarioService.getAll(req.user.id_usuario, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    materia_id: materia_id ? parseInt(materia_id, 10) : undefined,
  });
  res.json({ success: true, ...data });
});

const getById = catchAsync(async (req, res) => {
  logger.info('Controller: getById cuestionario', { usuarioId: req.user?.id_usuario, id: req.params.id });
  const data = await cuestionarioService.getById(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, data });
});

const create = catchAsync(async (req, res) => {
  const { profesor_id } = req.body;
  logger.info('Controller: create cuestionario', { profesor_id, title: req.body.title, esIA: req.body.esIA });
  logger.debug(req.body)
  await cuestionarioService.create(parseInt(profesor_id, 10), req.body);
  res.status(201).json({ success: true, message: 'Cuestionario creado' });
});

const update = catchAsync(async (req, res) => {
  logger.info('Controller: update cuestionario', { usuarioId: req.user?.id_usuario, id: req.params.id });
  await cuestionarioService.update(
    req.user.id_usuario,
    parseInt(req.params.id, 10),
    req.body,
  );
  res.json({ success: true, message: 'Cuestionario actualizado' });
});

const remove = catchAsync(async (req, res) => {
  logger.info('Controller: remove cuestionario', { usuarioId: req.user?.id_usuario, id: req.params.id });
  await cuestionarioService.remove(req.user.id_usuario, parseInt(req.params.id, 10));
  res.json({ success: true, message: 'Cuestionario eliminado' });
});

module.exports = { getAll, getById, create, update, remove };
