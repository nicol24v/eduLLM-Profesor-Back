require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const SocketServer = require('./src/infrastructure/socket/SocketServer');
const logger = require('./src/config/logger');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8082;

const server = http.createServer(app);
SocketServer.init(server);

server.listen(PORT, HOST, () => {
  logger.info(`Profesor MS running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
