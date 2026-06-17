'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const GameStatus = require('../../domain/game/GameStatus');
const GamePlayer = require('../../domain/game/GamePlayer');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');

class JoinGameUseCase {
  #registry;
  #sqliteRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
  }

  execute({ codigoAcceso, socketId, playerId, nickname }) {
    logger.info('UseCase: JoinGame', { codigoAcceso, playerId, nickname });
    try {
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');
      if (room.status !== GameStatus.SHOW_ROOM) {
        throw new AppError('La partida ya ha comenzado', 400, 'GAME_ALREADY_STARTED');
      }

      const existing = room.getPlayer(playerId);
      if (existing) {
        existing.updateSocket(socketId);
        this.#sqliteRepo.savePlayer(room.partidaId, existing);
        logger.info('UseCase: JoinGame player reconnected', { codigoAcceso, playerId });
        return { room, player: existing, reconnected: true };
      }

      const player = new GamePlayer({ socketId, playerId, nickname });
      room.addPlayer(player);
      this.#sqliteRepo.savePlayer(room.partidaId, player);

      logger.info('UseCase: JoinGame completed', { codigoAcceso, playerId, nickname });
      return { room, player, reconnected: false };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: JoinGame error', { codigoAcceso, playerId, error: error.message });
      throw error;
    }
  }
}

module.exports = JoinGameUseCase;
