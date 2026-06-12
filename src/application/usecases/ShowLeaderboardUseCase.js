'use strict';

const AppError = require('../../utils/AppError');
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
    const room = this.#registry.findByPartidaId(partidaId);
    if (!room) throw new AppError('Sala no encontrada', 404);

    room.closeAnswers();
    room.transitionTo(GameStatus.SHOW_RESPONSES);
    this.#sqliteRepo.updateRoomStatus(partidaId, GameStatus.SHOW_RESPONSES);

    const results = room.getQuestionResults();
    const leaderboard = room.getLeaderboard();

    return { room, results, leaderboard };
  }
}

module.exports = ShowLeaderboardUseCase;
