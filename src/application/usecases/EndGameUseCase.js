'use strict';

const AppError = require('../../utils/AppError');
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
    const room = this.#registry.findByPartidaId(partidaId);
    if (!room) throw new AppError('Sala no encontrada', 404);
    if (room.isFinished()) throw new AppError('La partida ya está finalizada', 400);

    room.transitionTo(GameStatus.FINISHED);

    await this.#prismaRepo.finalizeGame(room);

    this.#sqliteRepo.deleteRoom(partidaId);
    this.#registry.remove(room);

    return { leaderboard: room.getLeaderboard() };
  }
}

module.exports = EndGameUseCase;
