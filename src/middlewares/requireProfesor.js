/**
 * Verifica que la petición provenga de un usuario autenticado con rol PROFESOR.
 * Depende de que authMiddleware haya poblado req.user antes.
 */
const requireProfesor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  if (req.user.rol !== 'PROFESOR') {
    return res.status(403).json({ success: false, message: 'Acceso denegado: solo profesores' });
  }
  next();
};

module.exports = requireProfesor;
