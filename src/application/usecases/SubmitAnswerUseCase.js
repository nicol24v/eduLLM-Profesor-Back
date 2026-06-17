'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const GameStatus = require('../../domain/game/GameStatus');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');

class SubmitAnswerUseCase {
  #registry;
  #sqliteRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
  }

  execute({ codigoAcceso, playerId, opcionId }) {
    logger.debug('UseCase: SubmitAnswer', { codigoAcceso, playerId, opcionId });
    try {
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');
      if (room.status !== GameStatus.SELECT_ANSWER) {
        return { accepted: false, reason: 'answers_not_open' };
      }

      const result = room.recordAnswer({ playerId, opcionId });

      if (result.accepted) {
        const player = room.getPlayer(playerId);
        if (player) {
          this.#sqliteRepo.updatePlayerAnswer(room.partidaId, playerId, {
            score: player.score,
            correctAnswers: player.correctAnswers,
            answerTime: player.getAnswerTime(),
          });
        }
        logger.debug('UseCase: SubmitAnswer accepted', { codigoAcceso, playerId });
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: SubmitAnswer error', { codigoAcceso, playerId, error: error.message });
      throw error;
    }
  }
}

module.exports = SubmitAnswerUseCase;
