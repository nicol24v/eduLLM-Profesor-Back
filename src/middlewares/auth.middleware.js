const logger = require('../config/logger');

const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
  } catch {
    return null;
  }
};

const extractTokenFromRequest = (req) => {
  const cookie = req.headers?.cookie;
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)jwtToken=([^;]+)/);
    if (match) return match[1];
  }
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
};

/**
 * Lee los headers inyectados por el Gateway (X-User-Id, X-User-Role, X-Username)
 * y los expone en req.user. No valida JWT — eso lo hace el Gateway.
 *
 * Fallback para desarrollo: si no vienen los headers del Gateway,
 * decodifica el JWT directo del Authorization header o cookie.
 */
const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const username = req.headers['x-username'];

  logger.debug('Auth headers received', {
    'x-user-id': userId,
    'x-user-role': userRole,
    'x-username': username,
  });

  if (userId && userRole) {
    req.user = {
      id_usuario: parseInt(userId, 10),
      rol: userRole,
      username: username || null,
    };
    logger.info(`Auth (Gateway): usuario ${userId} (${userRole}) autenticado`);
    return next();
  }

  // Fallback: decodificar JWT directo (desarrollo, sin Gateway)
  const token = extractTokenFromRequest(req);
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload && payload.idUsuario && payload.rol) {
      req.user = {
        id_usuario: payload.idUsuario,
        rol: payload.rol,
        username: payload.sub || null,
      };
      logger.info(`Auth (JWT directo): usuario ${payload.idUsuario} (${payload.rol}) autenticado`);
      return next();
    }
  }

  logger.warn('Auth: sin autenticación', {
    url: req.originalUrl,
    method: req.method,
  });

  next();
};

module.exports = authMiddleware;
