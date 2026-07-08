'use strict';

const { Server } = require('socket.io');
const ManagerSocketHandler = require('./handlers/ManagerSocketHandler');
const PlayerSocketHandler = require('./handlers/PlayerSocketHandler');

class SocketServer {
  static #instance = null;

  #io;
  #managerHandler;
  #playerHandler;

  constructor(httpServer) {
    this.#io = new Server(httpServer, {
      path: '/game/socket.io',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingInterval: 10000,  // Ping cada 10 segundos
      pingTimeout: 5000,    // Timeout después de 5 segundos sin respuesta
    });

    this.#managerHandler = new ManagerSocketHandler(this.#io);
    this.#playerHandler = new PlayerSocketHandler(this.#io);

    this.#io.on('connection', (socket) => this.#onConnection(socket));
  }

  static init(httpServer) {
    if (!SocketServer.#instance) {
      SocketServer.#instance = new SocketServer(httpServer);
    }
    return SocketServer.#instance;
  }

  static getInstance() {
    return SocketServer.#instance;
  }

  getIO() {
    return this.#io;
  }

  #onConnection(socket) {
    const role = socket.handshake.query?.role;
    console.log(`[DEBUG] Nuevo socket conectado: ${socket.id}, role: ${role}`);

    if (role === 'manager') {
      this.#managerHandler.register(socket);
    } else {
      this.#playerHandler.register(socket);
    }

    socket.on('disconnect', (reason) => {
      console.log(`[DEBUG] Socket desconectado: ${socket.id}, razón: ${reason}`);
      this.#playerHandler.handleDisconnect(socket);
    });
  }
}

module.exports = SocketServer;
