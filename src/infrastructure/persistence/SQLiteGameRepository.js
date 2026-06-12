'use strict';

const SQLiteClient = require('./SQLiteClient');

/**
 * Persists game state to SQLite during active quiz.
 * Used by use cases that mutate GameRoom — ensures state survives process restart.
 */
class SQLiteGameRepository {
  #db;

  constructor() {
    this.#db = SQLiteClient.getInstance().db;
  }

  saveRoom(room) {
    const data = room.toJSON();
    this.#db.prepare(`
      INSERT INTO game_rooms (partida_id, codigo_acceso, status, question_index, answers_closed)
      VALUES (@partidaId, @codigoAcceso, @status, @currentQuestionIndex, 0)
      ON CONFLICT(partida_id) DO UPDATE SET
        status = excluded.status,
        question_index = excluded.question_index,
        answers_closed = 0
    `).run({
      partidaId: data.partidaId,
      codigoAcceso: data.codigoAcceso,
      status: data.status,
      currentQuestionIndex: data.currentQuestionIndex,
    });
  }

  updateRoomStatus(partidaId, status) {
    this.#db.prepare(
      `UPDATE game_rooms SET status = ? WHERE partida_id = ?`
    ).run(status, partidaId);
  }

  updateQuestionState(partidaId, { questionIndex, startedAt, answersClosed }) {
    this.#db.prepare(`
      UPDATE game_rooms
      SET question_index = ?, question_started_at = ?, answers_closed = ?
      WHERE partida_id = ?
    `).run(questionIndex, startedAt, answersClosed ? 1 : 0, partidaId);
  }

  savePlayer(partidaId, player) {
    const p = player.toJSON();
    this.#db.prepare(`
      INSERT INTO game_players (player_id, partida_id, socket_id, nickname, score, correct_answers)
      VALUES (@playerId, @partidaId, @socketId, @nickname, @score, @correctAnswers)
      ON CONFLICT(player_id, partida_id) DO UPDATE SET
        socket_id = excluded.socket_id,
        score = excluded.score,
        correct_answers = excluded.correct_answers,
        answer_time = NULL
    `).run({ ...p, partidaId });
  }

  updatePlayerAnswer(partidaId, playerId, { score, correctAnswers, answerTime }) {
    this.#db.prepare(`
      UPDATE game_players
      SET score = ?, correct_answers = ?, answer_time = ?
      WHERE player_id = ? AND partida_id = ?
    `).run(score, correctAnswers, answerTime, playerId, partidaId);
  }

  deleteRoom(partidaId) {
    this.#db.prepare(`DELETE FROM game_players WHERE partida_id = ?`).run(partidaId);
    this.#db.prepare(`DELETE FROM game_rooms WHERE partida_id = ?`).run(partidaId);
  }

  getAllRooms() {
    return this.#db.prepare(`SELECT * FROM game_rooms`).all();
  }
}

module.exports = SQLiteGameRepository;
