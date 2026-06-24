'use strict';

const GameStatus = require('../../../domain/game/GameStatus');
const GameRegistry = require('../../../domain/game/GameRegistry');
const JoinGameUseCase = require('../../../application/usecases/JoinGameUseCase');
const SubmitAnswerUseCase = require('../../../application/usecases/SubmitAnswerUseCase');

class PlayerSocketHandler {
  #io;
  #joinGame;
  #submitAnswer;
  #registry;

  constructor(io) {
    this.#io = io;
    this.#joinGame = new JoinGameUseCase();
    this.#submitAnswer = new SubmitAnswerUseCase();
    this.#registry = GameRegistry.getInstance();
  }

  register(socket) {
    socket.on('player:join', (data, ack) => this.#onJoin(socket, data, ack));
    socket.on('player:answer', (data, ack) => this.#onAnswer(socket, data, ack));
    socket.on('player:leave', () => this.#onLeave(socket));
  }

  async #onJoin(socket, data, ack) {
    try {
      const { codigoAcceso, playerId, nickname } = data;
      const { room, player, reconnected } = await this.#joinGame.execute({
        codigoAcceso,
        socketId: socket.id,
        playerId,
        nickname,
      });

      socket.join(`game:${codigoAcceso}`);
      socket.data.codigoAcceso = codigoAcceso;
      socket.data.playerId = playerId;
      socket.data.role = 'player';

      this.#io.to(`game:${codigoAcceso}`).emit('game:player_joined', {
        playerId: player.playerId,
        nickname: player.nickname,
        playerCount: room.getPlayerCount(),
        reconnected,
      });

      ack?.({
        ok: true,
        data: {
          status: room.status,
          playerCount: room.getPlayerCount(),
          titulo: room.prueba.titulo,
          totalPreguntas: room.totalQuestions,
        },
      });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onAnswer(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const playerId = data?.playerId || socket.data.playerId;

      const result = this.#submitAnswer.execute({
        codigoAcceso,
        playerId,
        opcionId: data.opcionId,
      });

      ack?.({ ok: true, data: result });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onLeave(socket) {
    const { codigoAcceso, playerId } = socket.data;
    if (!codigoAcceso || !playerId) return;

    const room = this.#registry.findByCode(codigoAcceso);
    if (!room || room.status !== GameStatus.SHOW_ROOM) return;

    room.removePlayer(playerId);
    socket.leave(`game:${codigoAcceso}`);

    this.#io.to(`game:${codigoAcceso}`).emit('game:player_left', {
      playerId,
      playerCount: room.getPlayerCount(),
    });
  }

  handleDisconnect(socket) {
    const { codigoAcceso, playerId, role } = socket.data;
    if (role !== 'player' || !codigoAcceso || !playerId) return;

    const room = this.#registry.findByCode(codigoAcceso);
    if (!room || room.status !== GameStatus.SHOW_ROOM) return;

    room.removePlayer(playerId);
    this.#io.to(`game:${codigoAcceso}`).emit('game:player_left', {
      playerId,
      playerCount: room.getPlayerCount(),
    });
  }
}

module.exports = PlayerSocketHandler;
