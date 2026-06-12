'use strict';

const AppError = require('../../utils/AppError');
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
    const room = this.#registry.findByCode(codigoAcceso);
    if (!room) throw new AppError('Sala no encontrada', 404);
    if (room.status !== GameStatus.SHOW_ROOM) {
      throw new AppError('La partida ya ha comenzado', 400);
    }

    const existing = room.getPlayer(playerId);
    if (existing) {
      existing.updateSocket(socketId);
      this.#sqliteRepo.savePlayer(room.partidaId, existing);
      return { room, player: existing, reconnected: true };
    }

    const player = new GamePlayer({ socketId, playerId, nickname });
    room.addPlayer(player);
    this.#sqliteRepo.savePlayer(room.partidaId, player);

    return { room, player, reconnected: false };
  }
}

module.exports = JoinGameUseCase;
