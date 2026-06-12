'use strict';

const GameStatus = require('../../../domain/game/GameStatus');
const GameRegistry = require('../../../domain/game/GameRegistry');
const CreateGameUseCase = require('../../../application/usecases/CreateGameUseCase');
const StartGameUseCase = require('../../../application/usecases/StartGameUseCase');
const NextQuestionUseCase = require('../../../application/usecases/NextQuestionUseCase');
const ShowLeaderboardUseCase = require('../../../application/usecases/ShowLeaderboardUseCase');
const EndGameUseCase = require('../../../application/usecases/EndGameUseCase');
const KickPlayerUseCase = require('../../../application/usecases/KickPlayerUseCase');

class ManagerSocketHandler {
  #io;
  #createGame;
  #startGame;
  #nextQuestion;
  #showLeaderboard;
  #endGame;
  #kickPlayer;
  #registry;

  constructor(io) {
    this.#io = io;
    this.#createGame = new CreateGameUseCase();
    this.#startGame = new StartGameUseCase();
    this.#nextQuestion = new NextQuestionUseCase();
    this.#showLeaderboard = new ShowLeaderboardUseCase();
    this.#endGame = new EndGameUseCase();
    this.#kickPlayer = new KickPlayerUseCase();
    this.#registry = GameRegistry.getInstance();
  }

  register(socket) {
    socket.on('manager:create_game', (data, ack) => this.#onCreateGame(socket, data, ack));
    socket.on('manager:start', (data, ack) => this.#onStart(socket, data, ack));
    socket.on('manager:next_question', (data, ack) => this.#onNextQuestion(socket, data, ack));
    socket.on('manager:open_answers', (data, ack) => this.#onOpenAnswers(socket, data, ack));
    socket.on('manager:show_leaderboard', (data, ack) => this.#onShowLeaderboard(socket, data, ack));
    socket.on('manager:end_game', (data, ack) => this.#onEndGame(socket, data, ack));
    socket.on('manager:kick_player', (data, ack) => this.#onKickPlayer(socket, data, ack));
    socket.on('manager:rejoin', (data, ack) => this.#onRejoin(socket, data, ack));
  }

  async #onCreateGame(socket, data, ack) {
    try {
      const { pruebaId, usuarioId } = data;
      const result = await this.#createGame.execute({
        usuarioId,
        pruebaId,
        managerSocketId: socket.id,
      });

      socket.join(`game:${result.codigoAcceso}`);
      socket.data.codigoAcceso = result.codigoAcceso;
      socket.data.role = 'manager';

      ack?.({ ok: true, data: result });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  async #onStart(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      await this.#startGame.execute({ partidaId: room.partidaId, usuarioId: data.usuarioId });

      room.updateManagerSocket(socket.id);
      this.#io.to(`game:${codigoAcceso}`).emit('game:started', {
        status: GameStatus.SHOW_START,
        titulo: room.prueba.titulo,
        totalPreguntas: room.totalQuestions,
      });

      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onNextQuestion(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      const { questionForPlayers, questionForManager } = this.#nextQuestion.execute({
        partidaId: room.partidaId,
      });

      this.#io.to(`game:${codigoAcceso}`).emit('game:question', questionForPlayers);
      socket.emit('game:question_manager', questionForManager);

      setTimeout(() => {
        const currentRoom = this.#registry.findByCode(codigoAcceso);
        if (currentRoom && currentRoom.status === GameStatus.SHOW_QUESTION) {
          currentRoom.openAnswers();
          this.#io.to(`game:${codigoAcceso}`).emit('game:open_answers', {
            questionIndex: questionForPlayers.index,
          });
        }
      }, questionForPlayers.cooldown * 1000);

      ack?.({ ok: true, data: questionForManager });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onOpenAnswers(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      room.openAnswers();
      this.#io.to(`game:${codigoAcceso}`).emit('game:open_answers', {
        questionIndex: room.currentQuestionIndex,
      });

      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onShowLeaderboard(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      const { results, leaderboard } = this.#showLeaderboard.execute({ partidaId: room.partidaId });

      this.#io.to(`game:${codigoAcceso}`).emit('game:responses', { results });
      this.#io.to(`game:${codigoAcceso}`).emit('game:leaderboard', { leaderboard });

      ack?.({ ok: true, data: { results, leaderboard } });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  async #onEndGame(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      const { leaderboard } = await this.#endGame.execute({ partidaId: room.partidaId });

      this.#io.to(`game:${codigoAcceso}`).emit('game:finished', { leaderboard });

      ack?.({ ok: true, data: { leaderboard } });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onKickPlayer(socket, data, ack) {
    try {
      const codigoAcceso = data?.codigoAcceso || socket.data.codigoAcceso;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      const { kickedSocketId } = this.#kickPlayer.execute({
        partidaId: room.partidaId,
        targetPlayerId: data.playerId,
      });

      const kickedSocket = this.#io.sockets.sockets.get(kickedSocketId);
      kickedSocket?.emit('game:kicked');
      kickedSocket?.leave(`game:${codigoAcceso}`);

      this.#io.to(`game:${codigoAcceso}`).emit('game:player_left', {
        playerId: data.playerId,
        playerCount: room.getPlayerCount(),
      });

      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }

  #onRejoin(socket, data, ack) {
    try {
      const { codigoAcceso } = data;
      const room = this.#registry.findByCode(codigoAcceso);
      if (!room) return ack?.({ ok: false, error: 'Sala no encontrada' });

      room.updateManagerSocket(socket.id);
      socket.join(`game:${codigoAcceso}`);
      socket.data.codigoAcceso = codigoAcceso;
      socket.data.role = 'manager';

      ack?.({ ok: true, data: room.toJSON() });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  }
}

module.exports = ManagerSocketHandler;
