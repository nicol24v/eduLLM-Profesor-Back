'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const GameStatus = require('../../domain/game/GameStatus');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');

class ShowLeaderboardUseCase {
  #registry;
  #sqliteRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
  }

  execute({ partidaId }) {
    logger.info('UseCase: ShowLeaderboard', { partidaId });
    try {
      const room = this.#registry.findByPartidaId(partidaId);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');

      room.closeAnswers();
      room.transitionTo(GameStatus.SHOW_RESPONSES);
      this.#sqliteRepo.updateRoomStatus(partidaId, GameStatus.SHOW_RESPONSES);

      const results = room.getQuestionResults();
      const leaderboard = room.getLeaderboard();

      logger.info('UseCase: ShowLeaderboard completed', { partidaId });
      return { room, results, leaderboard };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: ShowLeaderboard error', { partidaId, error: error.message });
      throw error;
    }
  }
}

module.exports = ShowLeaderboardUseCase;
