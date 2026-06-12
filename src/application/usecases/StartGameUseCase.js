'use strict';

const AppError = require('../../utils/AppError');
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
    const room = this.#registry.findByPartidaId(partidaId);
    if (!room) throw new AppError('Sala no encontrada', 404);
    if (room.status !== GameStatus.SHOW_ROOM) {
      throw new AppError('La partida no está en sala de espera', 400);
    }

    room.transitionTo(GameStatus.SHOW_START);
    this.#sqliteRepo.updateRoomStatus(partidaId, GameStatus.SHOW_START);
    await this.#prismaRepo.markPartidaInProgress(partidaId, usuarioId);

    return { room };
  }
}

module.exports = StartGameUseCase;
