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

      const allPlayers = room.getPlayers().map(p => ({
        playerId: p.playerId,
        nickname: p.nickname,
        disconnected: p.disconnected,
        socketId: p.socketId,
      }));
      console.log(`[DEBUG] Sala ${codigoAcceso} - Total jugadores: ${allPlayers.length}, Conectados: ${room.getConnectedPlayerCount()}`, JSON.stringify(allPlayers));

      socket.join(`game:${codigoAcceso}`);
      socket.data.codigoAcceso = codigoAcceso;
      socket.data.playerId = playerId;
      socket.data.role = 'player';

      this.#io.to(`game:${codigoAcceso}`).emit('game:player_joined', {
        playerId: player.playerId,
        nickname: player.nickname,
        playerCount: room.getConnectedPlayerCount(),
        reconnected,
      });

      const roomJson = room.toJSON();
      ack?.({
        ok: true,
        data: {
          status: room.status,
          playerCount: room.getConnectedPlayerCount(),
          players: room.getPlayers()
            .filter(p => !p.disconnected)
            .map((p) => ({
              playerId: p.playerId,
              nickname: p.nickname,
            })),
          titulo: room.prueba.titulo,
          totalPreguntas: room.totalQuestions,
          currentQuestion: roomJson.currentQuestion,
          currentQuestionIndex: roomJson.currentQuestionIndex,
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
      playerCount: room.getConnectedPlayerCount(),
    });
  }

  handleDisconnect(socket) {
    const { codigoAcceso, playerId, role } = socket.data;
    if (role !== 'player' || !codigoAcceso || !playerId) return;

    const room = this.#registry.findByCode(codigoAcceso);
    if (!room) return;

    const player = room.getPlayer(playerId);
    if (player) {
      player.setDisconnected(true);
      console.log(`[DEBUG] Jugador desconectado: ${playerId} (${player.nickname}) en sala ${codigoAcceso}`);
    }

    const allPlayers = room.getPlayers().map(p => ({
      playerId: p.playerId,
      nickname: p.nickname,
      disconnected: p.disconnected,
    }));
    console.log(`[DEBUG] Estado sala ${codigoAcceso} después de desconexión:`, JSON.stringify(allPlayers));

    this.#io.to(`game:${codigoAcceso}`).emit('game:player_left', {
      playerId,
      playerCount: room.getConnectedPlayerCount(),
    });
  }
}

module.exports = PlayerSocketHandler;
