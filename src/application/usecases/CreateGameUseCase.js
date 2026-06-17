'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const { generateAccessCode } = require('../../utils/codeGenerator');
const GameRoom = require('../../domain/game/GameRoom');
const GameRegistry = require('../../domain/game/GameRegistry');
const PrismaGameRepository = require('../../infrastructure/persistence/PrismaGameRepository');
const SQLiteGameRepository = require('../../infrastructure/persistence/SQLiteGameRepository');

class CreateGameUseCase {
  #prismaRepo;
  #sqliteRepo;
  #registry;

  constructor() {
    this.#prismaRepo = new PrismaGameRepository();
    this.#sqliteRepo = new SQLiteGameRepository();
    this.#registry = GameRegistry.getInstance();
  }

  async execute({ usuarioId, pruebaId, managerSocketId }) {
    logger.info('UseCase: CreateGame', { usuarioId, pruebaId });
    try {
      const profesor = await prisma.tbl_m_profesor.findUnique({
        where: { usuario_id: usuarioId, estado: true },
      });
      if (!profesor) throw new AppError('Profesor no encontrado', 404, 'PROFESOR_NOT_FOUND');

      const dbPrueba = await this.#prismaRepo.findPruebaForGame(pruebaId);
      if (!dbPrueba) throw new AppError('Cuestionario no encontrado', 404, 'CUESTIONARIO_NOT_FOUND');
      if (dbPrueba.tbl_t_pregunta.length === 0) {
        throw new AppError('El cuestionario no tiene preguntas', 400, 'NO_PREGUNTAS');
      }

      let codigoAcceso;
      for (let i = 0; i < 10; i++) {
        const candidato = generateAccessCode();
        const existe = await prisma.tbl_t_partida.findUnique({ where: { codigo_acceso: candidato } });
        if (!existe) { codigoAcceso = candidato; break; }
      }
      if (!codigoAcceso) throw new AppError('No se pudo generar un código único', 500, 'CODIGO_GENERATION_FAILED');

      const partida = await prisma.tbl_t_partida.create({
        data: {
          prueba_id: dbPrueba.id_prueba,
          codigo_acceso: codigoAcceso,
          estado_partida: 'esperando',
          usuario_creacion: usuarioId,
        },
      });

      const prueba = {
        id_prueba: dbPrueba.id_prueba,
        titulo: dbPrueba.titulo,
        preguntas: dbPrueba.tbl_t_pregunta.map((p) => ({
          id_pregunta: p.id_pregunta,
          texto: p.texto,
          tipo: p.tipo,
          tiempo_limite: p.tiempo_limite,
          cooldown: p.cooldown,
          image_url: p.image_url,
          opciones: p.tbl_t_opcion.map((o) => ({
            id_opcion: o.id_opcion,
            texto: o.texto,
            orden: o.orden,
            es_correcta: o.es_correcta,
          })),
        })),
      };

      const room = new GameRoom({
        partidaId: partida.id_partida,
        codigoAcceso,
        prueba,
        managerSocketId,
      });

      this.#registry.register(room);
      this.#sqliteRepo.saveRoom(room);

      logger.info('UseCase: CreateGame completed', { usuarioId, partidaId: partida.id_partida, codigoAcceso });

      return {
        partidaId: partida.id_partida,
        codigoAcceso,
        titulo: dbPrueba.titulo,
        totalPreguntas: prueba.preguntas.length,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: CreateGame error', { usuarioId, pruebaId, error: error.message });
      throw error;
    }
  }
}

module.exports = CreateGameUseCase;
