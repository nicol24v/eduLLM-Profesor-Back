'use strict';

/**
 * Singleton registry that maps codigoAcceso → GameRoom and partidaId → GameRoom.
 * All in-process game state lives here until persisted to PostgreSQL on FINISHED.
 */
class GameRegistry {
  static #instance = null;

  #byCode;
  #byPartidaId;

  constructor() {
    this.#byCode = new Map();
    this.#byPartidaId = new Map();
  }

  static getInstance() {
    if (!GameRegistry.#instance) {
      GameRegistry.#instance = new GameRegistry();
    }
    return GameRegistry.#instance;
  }

  register(room) {
    this.#byCode.set(room.codigoAcceso, room);
    this.#byPartidaId.set(room.partidaId, room);
  }

  findByCode(codigoAcceso) {
    return this.#byCode.get(codigoAcceso) || null;
  }

  findByPartidaId(partidaId) {
    return this.#byPartidaId.get(partidaId) || null;
  }

  remove(room) {
    this.#byCode.delete(room.codigoAcceso);
    this.#byPartidaId.delete(room.partidaId);
  }

  getAll() {
    return [...this.#byPartidaId.values()];
  }
}

module.exports = GameRegistry;
