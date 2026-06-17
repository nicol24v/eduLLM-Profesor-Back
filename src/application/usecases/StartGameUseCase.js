'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const GameStatus = require('../../domain/game/GameStatus');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');
const PrismaGameRepository = require('../../infrastructure/persistence/PrismaGameRepository');

class StartGameUseCase {
  #registry;
  #sqliteRepo;
  #prismaRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
    this.#prismaRepo = new PrismaGameRepository();
  }

  async execute({ partidaId, usuarioId }) {
    logger.info('UseCase: StartGame', { partidaId, usuarioId });
    try {
      const room = this.#registry.findByPartidaId(partidaId);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');
      if (room.status !== GameStatus.SHOW_ROOM) {
        throw new AppError('La partida no está en sala de espera', 400, 'INVALID_STATUS');
      }

      room.transitionTo(GameStatus.SHOW_START);
      this.#sqliteRepo.updateRoomStatus(partidaId, GameStatus.SHOW_START);
      await this.#prismaRepo.markPartidaInProgress(partidaId, usuarioId);

      logger.info('UseCase: StartGame completed', { partidaId, usuarioId });
      return { room };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: StartGame error', { partidaId, usuarioId, error: error.message });
      throw error;
    }
  }
}

module.exports = StartGameUseCase;
