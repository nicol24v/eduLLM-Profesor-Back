const logger = require('../config/logger');
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Prisma: registro no encontrado
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Recurso no encontrado' });
  }

  // Prisma: violación de unicidad
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Ya existe un registro con ese valor' });
  }

  res.status(500).json({ success: false, message: 'Internal Server Error' });
};

module.exports = { errorHandler };
