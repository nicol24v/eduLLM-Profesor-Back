const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const { errorHandler } = require('./middlewares/errorHandler');
const { logRequest } = require('./middlewares/logger.middleware');
const authMiddleware = require('./middlewares/auth.middleware');
const { globalSanitizer } = require('./middlewares/sanitize.middleware');
const routes = require('./routes');
const preguntasRoutes = require('./routes/v1/preguntas.routes');

const app = express();

// Seguridad básica (CORS lo maneja el gateway)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
}));

// Logging de cada request
app.use(logRequest);

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')());

// Lee headers inyectados por el gateway (X-User-Id, X-User-Role, X-Username)
app.use(authMiddleware);

// Sanitización global automática
app.use(globalSanitizer);

// Rutas del microservicio de profesores
app.use('/api/profesor', routes);

// Ruta para importar quizzes desde el microservicio de IA
app.use('/api/preguntas', preguntasRoutes);

// Manejador de errores (siempre al final)
app.use(errorHandler);

module.exports = app;
