'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const GameStatus = require('../../domain/game/GameStatus');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');

class NextQuestionUseCase {
  #registry;
  #sqliteRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
  }

  execute({ partidaId }) {
    logger.info('UseCase: NextQuestion', { partidaId });
    try {
      const room = this.#registry.findByPartidaId(partidaId);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');

      const allowedStatuses = [
        GameStatus.SHOW_START,
        GameStatus.SHOW_PREPARED,
        GameStatus.SHOW_RESPONSES,
        GameStatus.SHOW_LEADERBOARD,
      ];
      if (!allowedStatuses.includes(room.status)) {
        throw new AppError(`No se puede avanzar pregunta desde el estado ${room.status}`, 400, 'INVALID_STATUS');
      }

      const nextIndex = room.currentQuestionIndex + 1;
      if (nextIndex >= room.totalQuestions) {
        throw new AppError('No hay más preguntas', 400, 'NO_MORE_QUESTIONS');
      }

      room.startQuestion(nextIndex);
      this.#sqliteRepo.updateQuestionState(partidaId, {
        questionIndex: nextIndex,
        startedAt: Date.now(),
        answersClosed: false,
      });

      const question = room.getCurrentQuestion();
      const questionForPlayers = {
        index: nextIndex,
        total: room.totalQuestions,
        texto: question.texto,
        tipo: question.tipo,
        tiempo_limite: question.tiempo_limite,
        cooldown: question.cooldown,
        image_url: question.image_url,
        opciones: question.opciones.map((o) => ({
          id_opcion: o.id_opcion,
          texto: o.texto,
          orden: o.orden,
        })),
      };

      const questionForManager = {
        ...questionForPlayers,
        opciones: question.opciones.map((o) => ({
          id_opcion: o.id_opcion,
          texto: o.texto,
          orden: o.orden,
          es_correcta: o.es_correcta,
        })),
      };

      logger.info('UseCase: NextQuestion completed', { partidaId, questionIndex: nextIndex });
      return { room, questionForPlayers, questionForManager };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: NextQuestion error', { partidaId, error: error.message });
      throw error;
    }
  }
}

module.exports = NextQuestionUseCase;
