'use strict';

const Database = require('better-sqlite3');
const path = require('path');

class SQLiteClient {
  static #instance = null;
  #db;

  constructor() {
    const dbPath = process.env.SQLITE_PATH
      ? path.resolve(process.env.SQLITE_PATH)
      : path.resolve('./game.db');

    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#migrate();
  }

  static getInstance() {
    if (!SQLiteClient.#instance) {
      SQLiteClient.#instance = new SQLiteClient();
    }
    return SQLiteClient.#instance;
  }

  get db() { return this.#db; }

  #migrate() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS game_rooms (
        partida_id  INTEGER PRIMARY KEY,
        codigo_acceso TEXT NOT NULL UNIQUE,
        status      TEXT NOT NULL,
        question_index INTEGER NOT NULL DEFAULT -1,
        question_started_at INTEGER,
        answers_closed INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );

      CREATE TABLE IF NOT EXISTS game_players (
        player_id   TEXT NOT NULL,
        partida_id  INTEGER NOT NULL,
        socket_id   TEXT NOT NULL,
        nickname    TEXT NOT NULL,
        score       INTEGER NOT NULL DEFAULT 0,
        correct_answers INTEGER NOT NULL DEFAULT 0,
        answer_time INTEGER,
        PRIMARY KEY (player_id, partida_id)
      );
    `);
  }
}

module.exports = SQLiteClient;
