const logger = require('../config/logger');

/**
 * Lee los headers inyectados por el Gateway (X-User-Id, X-User-Role, X-Username)
 * y los expone en req.user. No valida JWT — eso lo hace el Gateway.
 */
const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const username = req.headers['x-username'];

  if (userId && userRole) {
    req.user = {
      id_usuario: parseInt(userId, 10),
      rol: userRole,
      username: username || null,
    };
    logger.info(`Auth: usuario ${userId} (${userRole}) autenticado`);
  }

  next();
};

module.exports = authMiddleware;
