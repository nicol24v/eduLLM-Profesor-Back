'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const GameStatus = require('../../domain/game/GameStatus');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');
const PrismaGameRepository = require('../../infrastructure/persistence/PrismaGameRepository');

class EndGameUseCase {
  #registry;
  #sqliteRepo;
  #prismaRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
    this.#prismaRepo = new PrismaGameRepository();
  }

  async execute({ partidaId }) {
    logger.info('UseCase: EndGame', { partidaId });
    try {
      const room = this.#registry.findByPartidaId(partidaId);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');
      if (room.isFinished()) throw new AppError('La partida ya está finalizada', 400, 'ALREADY_FINISHED');

      room.transitionTo(GameStatus.FINISHED);

      const idPartidaEstudianteMap = await this.#prismaRepo.finalizeGame(room);

      this.#sqliteRepo.deleteRoom(partidaId);
      this.#registry.remove(room);

      logger.info('UseCase: EndGame completed', { partidaId });
      return { leaderboard: room.getLeaderboard(), idPartidaEstudianteMap };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: EndGame error', { partidaId, error: error.message });
      throw error;
    }
  }
}

module.exports = EndGameUseCase;
