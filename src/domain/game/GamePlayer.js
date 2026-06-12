'use strict';

class GamePlayer {
  #socketId;
  #playerId;
  #nickname;
  #score;
  #correctAnswers;
  #currentAnswerTime;

  constructor({ socketId, playerId, nickname }) {
    this.#socketId = socketId;
    this.#playerId = playerId;
    this.#nickname = nickname;
    this.#score = 0;
    this.#correctAnswers = 0;
    this.#currentAnswerTime = null;
  }

  get socketId() { return this.#socketId; }
  get playerId() { return this.#playerId; }
  get nickname() { return this.#nickname; }
  get score() { return this.#score; }
  get correctAnswers() { return this.#correctAnswers; }

  updateSocket(socketId) {
    this.#socketId = socketId;
  }

  recordAnswer(points) {
    this.#score += points;
    if (points > 0) this.#correctAnswers += 1;
    this.#currentAnswerTime = null;
  }

  setAnswerTime(timestamp) {
    this.#currentAnswerTime = timestamp;
  }

  getAnswerTime() {
    return this.#currentAnswerTime;
  }

  toLeaderboardEntry(position) {
    return {
      position,
      playerId: this.#playerId,
      nickname: this.#nickname,
      score: this.#score,
      correctAnswers: this.#correctAnswers,
    };
  }

  toJSON() {
    return {
      socketId: this.#socketId,
      playerId: this.#playerId,
      nickname: this.#nickname,
      score: this.#score,
      correctAnswers: this.#correctAnswers,
    };
  }
}

module.exports = GamePlayer;
