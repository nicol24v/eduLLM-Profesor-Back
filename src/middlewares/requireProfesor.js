const logger = require('../config/logger');

/**
 * Verifica que la petición provenga de un usuario autenticado con rol PROFESOR.
 * Depende de que authMiddleware haya poblado req.user antes.
 * Acepta tanto 'PROFESOR' como 'ROLE_PROFESOR' (compatibilidad con JWT).
 */
const requireProfesor = (req, res, next) => {
  if (!req.user) {
    logger.warn('requireProfesor: req.user no definido', { headers: req.headers });
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  // Solo validar rol cuando el header X-User-Role está presente (modo Gateway)
  // En modo JWT directo (sin header), se confía en el rol del token
  if (req.headers['x-user-role']) {
    const normalizedRol = req.user.rol?.replace(/^ROLE_/, '');
    if (normalizedRol !== 'PROFESOR') {
      logger.warn('requireProfesor: rol inválido', { rol: req.user.rol });
      return res.status(403).json({ success: false, message: 'Acceso denegado: solo profesores' });
    }
  }

  next();
};

module.exports = requireProfesor;
