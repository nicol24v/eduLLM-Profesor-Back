'use strict';

const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
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
    logger.info('UseCase: KickPlayer', { partidaId, targetPlayerId });
    try {
      const room = this.#registry.findByPartidaId(partidaId);
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');
      if (room.status !== GameStatus.SHOW_ROOM) {
        throw new AppError('Solo se puede expulsar jugadores en la sala de espera', 400, 'INVALID_STATUS');
      }

      const player = room.getPlayer(targetPlayerId);
      if (!player) throw new AppError('Jugador no encontrado', 404, 'PLAYER_NOT_FOUND');

      room.removePlayer(targetPlayerId);

      this.#sqliteRepo.db
        .prepare(`DELETE FROM game_players WHERE player_id = ? AND partida_id = ?`)
        .run(targetPlayerId, partidaId);

      logger.info('UseCase: KickPlayer completed', { partidaId, targetPlayerId });
      return { kickedSocketId: player.socketId };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: KickPlayer error', { partidaId, targetPlayerId, error: error.message });
      throw error;
    }
  }
}

module.exports = KickPlayerUseCase;
