const logger = require('../config/logger');
const AppError = require('../utils/AppError');

const PRISMA_ERROR_CODES = {
  P2025: { status: 404, message: 'Recurso no encontrado' },
  P2002: { status: 409, message: 'Ya existe un registro con ese valor' },
  P2003: { status: 400, message: 'Violación de clave foránea' },
  P2014: { status: 400, message: 'Violación de relación requerida' },
  P2016: { status: 400, message: 'Error de interpretación de consulta' },
};

const errorHandler = (err, req, res, _next) => {
  const userContext = req.user
    ? { userId: req.user.id_usuario, rol: req.user.rol }
    : { userId: null, rol: null };

  if (err instanceof AppError) {
    logger.warn('Operational error', {
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      ...userContext,
      url: req.originalUrl,
      method: req.method,
    });
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Prisma known errors
  if (err.code && PRISMA_ERROR_CODES[err.code]) {
    const { status, message } = PRISMA_ERROR_CODES[err.code];
    logger.warn('Prisma error', {
      prismaCode: err.code,
      message: err.message,
      ...userContext,
      url: req.originalUrl,
    });
    return res.status(status).json({ success: false, message });
  }

  // Validation errors (Zod / express-validator)
  if ((err.name === 'ZodError' || err.issues) || (err.errors && Array.isArray(err.errors))) {
    logger.warn('Validation error', {
      issues: err.issues || err.errors,
      ...userContext,
      url: req.originalUrl,
    });
    return res.status(400).json({ success: false, message: 'Error de validación' });
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    ...userContext,
    url: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({ success: false, message: 'Error interno del servidor' });
};

module.exports = { errorHandler };
