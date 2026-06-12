const { body } = require('express-validator');
const validator = require('validator');

const globalSanitizer = (req, _res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return validator.trim(validator.escape(value));
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
      return sanitizeObject(value);
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeValue(value);
    }
    return result;
  };

  if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

const sanitizeCuestionario = [
  body('titulo').trim().escape(),
  body('descripcion').optional().trim().escape(),
];

const sanitizePregunta = [
  body('texto').trim().escape(),
  body('tipo').optional().trim().escape(),
  body('tiempo_limite').optional().toInt(),
  body('cooldown').optional().toInt(),
];

module.exports = {
  globalSanitizer,
  sanitizeCuestionario,
  sanitizePregunta,
};
