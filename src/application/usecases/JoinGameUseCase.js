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

  async execute({ codigoAcceso, socketId, playerId, nickname }) {
    logger.info('UseCase: JoinGame', { codigoAcceso, playerId, nickname });
    try {
      let room = this.#registry.findByCode(codigoAcceso);
      if (!room) {
        const partidaService = require('../../services/partida.service');
        room = await partidaService.reconstructRoom(codigoAcceso);
        if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');
      }
      const existing = room.getPlayer(playerId);
      if (existing) {
        if (room.status === GameStatus.FINISHED) {
          throw new AppError('La partida ya finalizó', 400, 'GAME_FINISHED');
        }
        existing.updateSocket(socketId);
        this.#sqliteRepo.savePlayer(room.partidaId, existing);
        logger.info('UseCase: JoinGame player reconnected', { codigoAcceso, playerId });
        return { room, player: existing, reconnected: true };
      }

      if (room.status !== GameStatus.SHOW_ROOM && room.status !== GameStatus.SHOW_START) {
        throw new AppError('La partida ya ha comenzado', 400, 'GAME_ALREADY_STARTED');
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
