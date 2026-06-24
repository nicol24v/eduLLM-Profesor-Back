'use strict';

const GameStatus = require('./GameStatus');
const GamePlayer = require('./GamePlayer');
const TimeBasedScoring = require('../scoring/TimeBasedScoring');

const scoring = new TimeBasedScoring();

class GameRoom {
  #partidaId;
  #codigoAcceso;
  #prueba;
  #managerSocketId;
  #players;
  #status;
  #currentQuestionIndex;
  #questionStartedAt;
  #answersClosed;

  constructor({ partidaId, codigoAcceso, prueba, managerSocketId }) {
    this.#partidaId = partidaId;
    this.#codigoAcceso = codigoAcceso;
    this.#prueba = prueba;
    this.#managerSocketId = managerSocketId;
    this.#players = new Map();
    this.#status = GameStatus.SHOW_ROOM;
    this.#currentQuestionIndex = -1;
    this.#questionStartedAt = null;
    this.#answersClosed = false;
  }

  get partidaId() { return this.#partidaId; }
  get codigoAcceso() { return this.#codigoAcceso; }
  get status() { return this.#status; }
  get managerSocketId() { return this.#managerSocketId; }
  get currentQuestionIndex() { return this.#currentQuestionIndex; }
  get totalQuestions() { return this.#prueba.preguntas.length; }
  get prueba() { return this.#prueba; }

  addPlayer(player) {
    this.#players.set(player.playerId, player);
  }

  removePlayer(playerId) {
    this.#players.delete(playerId);
  }

  getPlayer(playerId) {
    return this.#players.get(playerId);
  }

  getPlayers() {
    return [...this.#players.values()];
  }

  getPlayerCount() {
    return this.#players.size;
  }

  updateManagerSocket(socketId) {
    this.#managerSocketId = socketId;
  }

  transitionTo(status) {
    this.#status = status;
  }

  startQuestion(index) {
    this.#currentQuestionIndex = index;
    this.#questionStartedAt = Date.now();
    this.#answersClosed = false;
    this.#status = GameStatus.SHOW_QUESTION;
  }

  openAnswers() {
    this.#answersClosed = false;
    this.#status = GameStatus.SELECT_ANSWER;
    this.#questionStartedAt = Date.now();
  }

  closeAnswers() {
    this.#answersClosed = true;
  }

  isAnswersClosed() {
    return this.#answersClosed;
  }

  getElapsedMs() {
    if (!this.#questionStartedAt) return 0;
    return Date.now() - this.#questionStartedAt;
  }

  getCurrentQuestion() {
    if (this.#currentQuestionIndex < 0) return null;
    return this.#prueba.preguntas[this.#currentQuestionIndex];
  }

  recordAnswer({ playerId, opcionId }) {
    if (this.#answersClosed) return { accepted: false };

    const player = this.#players.get(playerId);
    if (!player) return { accepted: false };

    if (player.getAnswerTime() !== null) return { accepted: false, duplicate: true };

    const question = this.getCurrentQuestion();
    if (!question) return { accepted: false };

    const elapsed = this.getElapsedMs();
    player.setAnswerTime(elapsed);

    const isCorrect = question.opciones.some(
      (o) => o.id_opcion === opcionId && o.es_correcta
    );

    const points = scoring.calculate({
      isCorrect,
      questionTimeSeconds: question.tiempo_limite,
      elapsedMs: elapsed,
    });

    player.recordAnswer({ opcionId, preguntaId: question.id_pregunta, points, elapsedMs: elapsed });

    return { accepted: true, isCorrect, points };
  }

  getLeaderboard() {
    return [...this.#players.values()]
      .sort((a, b) => b.score - a.score || b.correctAnswers - a.correctAnswers)
      .map((p, idx) => p.toLeaderboardEntry(idx + 1));
  }

  getQuestionResults() {
    const question = this.getCurrentQuestion();
    if (!question) return [];

    const counts = {};
    for (const opcion of question.opciones) {
      counts[opcion.id_opcion] = 0;
    }

    for (const player of this.#players.values()) {
      if (player.getAnswerTime() !== null) {
        for (const opcion of question.opciones) {
          if (player.getAnswerTime() !== null) {
            counts[opcion.id_opcion] = (counts[opcion.id_opcion] || 0);
          }
        }
      }
    }

    return question.opciones.map((o) => ({
      id_opcion: o.id_opcion,
      texto: o.texto,
      es_correcta: o.es_correcta,
      respuestas: counts[o.id_opcion] || 0,
    }));
  }

  isFinished() {
    return this.#status === GameStatus.FINISHED;
  }

  toJSON() {
    return {
      partidaId: this.#partidaId,
      codigoAcceso: this.#codigoAcceso,
      status: this.#status,
      currentQuestionIndex: this.#currentQuestionIndex,
      totalQuestions: this.totalQuestions,
      playerCount: this.#players.size,
      players: this.getPlayers().map((p) => p.toJSON()),
    };
  }
}

module.exports = GameRoom;
