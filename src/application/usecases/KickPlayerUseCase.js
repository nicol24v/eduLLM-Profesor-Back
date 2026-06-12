'use strict';

const AppError = require('../../utils/AppError');
const GameStatus = require('../../domain/game/GameStatus');
const GameRegistry = require('../../domain/game/GameRegistry');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');

class KickPlayerUseCase {
  #registry;
  #sqliteRepo;

  constructor() {
    this.#registry = GameRegistry.getInstance();
    this.#sqliteRepo = new SQLiteGameRepository();
  }

  execute({ partidaId, targetPlayerId }) {
    const room = this.#registry.findByPartidaId(partidaId);
    if (!room) throw new AppError('Sala no encontrada', 404);
    if (room.status !== GameStatus.SHOW_ROOM) {
      throw new AppError('Solo se puede expulsar jugadores en la sala de espera', 400);
    }

    const player = room.getPlayer(targetPlayerId);
    if (!player) throw new AppError('Jugador no encontrado', 404);

    room.removePlayer(targetPlayerId);

    this.#sqliteRepo.db
      .prepare(`DELETE FROM game_players WHERE player_id = ? AND partida_id = ?`)
      .run(targetPlayerId, partidaId);

    return { kickedSocketId: player.socketId };
  }
}

module.exports = KickPlayerUseCase;
