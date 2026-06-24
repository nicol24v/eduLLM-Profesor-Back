const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { generateAccessCode } = require('../utils/codeGenerator');
const GameRoom = require('../domain/game/GameRoom');
const GameRegistry = require('../domain/game/GameRegistry');
const SQLiteGameRepository = require('../infrastructure/persistence/SQLiteGameRepository');
const PartidaRepository = require('../repositories/partida.repository');
const PartidaMapper = require('../mappers/partida.mapper');
const StartGameUseCase = require('../application/usecases/StartGameUseCase');
const SocketServer = require('../infrastructure/socket/SocketServer');

class PartidaService {
  async #getProfesorOrFail(usuarioId) {
    logger.debug('Looking up profesor by usuario', { usuarioId });
    const profesor = await prisma.tbl_m_profesor.findUnique({
      where: { usuario_id: usuarioId, estado: true },
    });
    if (!profesor) {
      logger.warn('Profesor not found', { usuarioId });
      throw new AppError('Profesor no encontrado', 404, 'PROFESOR_NOT_FOUND');
    }
    return profesor;
  }

  async #assertPartidaOwnership(partidaId, profesor) {
    logger.debug('Asserting partida ownership', { partidaId, profesorId: profesor.id_profesor });
    const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);

    const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds);

    const partida = await prisma.tbl_t_partida.findFirst({
      where: { id_partida: partidaId, prueba_id: { in: pruebasIds }, estado: true },
      include: {
        tbl_t_prueba: {
          include: {
            tbl_t_pregunta: { where: { estado: true }, orderBy: { id_pregunta: 'asc' } },
          },
        },
      },
    });
    if (!partida) {
      logger.warn('Partida ownership assertion failed', { partidaId, profesorId: profesor.id_profesor });
      throw new AppError('Partida no encontrada o sin acceso', 404, 'PARTIDA_NOT_FOUND');
    }
    return partida;
  }

  async getHistory(usuarioId, { page, limit, prueba_id }) {
    logger.info('Fetching partida history', { usuarioId, page, limit, prueba_id });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);
      const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds, prueba_id);

      const skip = (page - 1) * limit;

      const [total, partidas] = await Promise.all([
        PartidaRepository.countByPruebaIds(pruebasIds),
        PartidaRepository.findPaginated(pruebasIds, skip, limit),
      ]);

      logger.info('Partida history fetched', { usuarioId, total, page, limit });
      return PartidaMapper.toHistoryListResponse(partidas, {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching partida history', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getById(usuarioId, partidaId) {
    logger.info('Fetching partida by id', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      return await this.#assertPartidaOwnership(partidaId, profesor);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching partida by id', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async getByCodigo(usuarioId, codigoAcceso) {
    logger.info('Fetching partida by codigo', { usuarioId, codigoAcceso });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);

      const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);
      const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds);

      const partida = await prisma.tbl_t_partida.findFirst({
        where: { codigo_acceso: codigoAcceso, prueba_id: { in: pruebasIds }, estado: true },
        include: { tbl_t_prueba: { select: { titulo: true } } },
      });
      if (!partida) {
        throw new AppError('Partida no encontrada o sin acceso', 404, 'PARTIDA_NOT_FOUND');
      }

      const totalPreguntas = await prisma.tbl_t_pregunta.count({
        where: { prueba_id: partida.prueba_id, estado: true },
      });

      return PartidaMapper.toCreatedResponse(partida, totalPreguntas);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching partida by codigo', { usuarioId, codigoAcceso, error: error.message });
      throw error;
    }
  }

  async create(usuarioId, body) {
    logger.info('Creating partida', { usuarioId, prueba_id: body.prueba_id });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      const { prueba_id } = body;

      if (!prueba_id) throw new AppError('El prueba_id es requerido', 400, 'PRUEBA_ID_REQUIRED');

      const profesorMateriaIds = await PartidaRepository.findProfesorMateriaIds(profesor.id_profesor);
      const pruebasIds = await PartidaRepository.findPruebaIdsByMateriaIds(profesorMateriaIds);

      const dbPrueba = await prisma.tbl_t_prueba.findFirst({
        where: { id_prueba: parseInt(prueba_id, 10), profesor_materia_id: { in: profesorMateriaIds }, estado: true },
        include: {
          tbl_t_pregunta: {
            where: { estado: true },
            include: { tbl_t_opcion: { where: { estado: true }, orderBy: { orden: 'asc' } } },
          },
        },
      });
      if (!dbPrueba) throw new AppError('Cuestionario no encontrado o sin acceso', 404, 'CUESTIONARIO_NOT_FOUND');
      if (dbPrueba.tbl_t_pregunta.length === 0) throw new AppError('El cuestionario no tiene preguntas', 400, 'NO_PREGUNTAS');

      let codigoAcceso;
      let intentos = 0;
      while (intentos < 10) {
        const candidato = generateAccessCode();
        const existe = await prisma.tbl_t_partida.findUnique({ where: { codigo_acceso: candidato } });
        if (!existe) {
          codigoAcceso = candidato;
          break;
        }
        intentos++;
      }
      if (!codigoAcceso) throw new AppError('No se pudo generar un código único, intente de nuevo', 500, 'CODIGO_GENERATION_FAILED');

      const partida = await prisma.tbl_t_partida.create({
        data: {
          prueba_id: dbPrueba.id_prueba,
          codigo_acceso: codigoAcceso,
          estado_partida: 'esperando',
          usuario_creacion: profesor.usuario_id,
        },
        include: { tbl_t_prueba: { select: { titulo: true } } },
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
        managerSocketId: null,
      });

      const registry = GameRegistry.getInstance();
      registry.register(room);
      new SQLiteGameRepository().saveRoom(room);

      logger.info('Partida created and registered in GameRegistry', {
        usuarioId, partidaId: partida.id_partida, codigo_acceso: codigoAcceso,
      });

      return PartidaMapper.toCreatedResponse(partida, dbPrueba.tbl_t_pregunta.length);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating partida', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getResultados(usuarioId, partidaId) {
    logger.info('Fetching resultados for partida', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertPartidaOwnership(partidaId, profesor);
      const resultados = await PartidaRepository.findResultados(partidaId);
      logger.info('Resultados fetched', { usuarioId, partidaId });
      return resultados;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching resultados', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async iniciar(usuarioId, partidaId) {
    logger.info('Iniciando partida', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertPartidaOwnership(partidaId, profesor);

      const startGame = new StartGameUseCase();
      await startGame.execute({ partidaId, usuarioId });

      const registry = GameRegistry.getInstance();
      const room = registry.findByPartidaId(partidaId);
      if (room) {
        const io = SocketServer.getInstance()?.getIO();
        if (io) {
          io.to(`game:${room.codigoAcceso}`).emit('game:started', {
            status: 'SHOW_START',
            titulo: room.prueba?.titulo,
            totalPreguntas: room.totalQuestions,
          });
        }
      }

      logger.info('Partida iniciada exitosamente', { usuarioId, partidaId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error iniciando partida', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async getRanking(usuarioId, partidaId) {
    logger.info('Fetching ranking for partida', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertPartidaOwnership(partidaId, profesor);

      const participaciones = await prisma.tbl_t_partida_estudiante.findMany({
        where: { partida_id: partidaId, estado: true },
        include: {
          tbl_m_estudiante_materia: {
            include: {
              tbl_m_estudiante: {
                include: {
                  tbl_m_usuario: { select: { primer_nombre: true, apellido_paterno: true } },
                },
              },
            },
          },
        },
        orderBy: [{ puntaje_total: 'desc' }, { respuestas_correctas: 'desc' }],
      });

      logger.info('Ranking fetched', { usuarioId, partidaId, totalParticipantes: participaciones.length });

      return PartidaMapper.toRankingResponse(participaciones);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching ranking', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async finalizar(usuarioId, partidaId) {
    logger.info('Finalizando partida', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      const partida = await this.#assertPartidaOwnership(partidaId, profesor);

      const registry = GameRegistry.getInstance();
      let room = registry.findByPartidaId(partidaId);
      if (!room) {
        room = await this.reconstructRoom(partida.codigo_acceso);
      }
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');

      const endGame = new (require('../application/usecases/EndGameUseCase'))();
      const { leaderboard, idPartidaEstudianteMap } = await endGame.execute({ partidaId });

      const io = SocketServer.getInstance()?.getIO();
      if (io) {
        io.to(`game:${room.codigoAcceso}`).emit('game:finished', { leaderboard, idPartidaEstudianteMap });
      }

      logger.info('Partida finalizada', { usuarioId, partidaId });
      return { leaderboard };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error finalizando partida', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async siguientePregunta(usuarioId, partidaId) {
    logger.info('Avanzando a siguiente pregunta', { usuarioId, partidaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      const partida = await this.#assertPartidaOwnership(partidaId, profesor);

      const registry = GameRegistry.getInstance();
      let room = registry.findByPartidaId(partidaId);
      if (!room) {
        room = await this.reconstructRoom(partida.codigo_acceso);
      }
      if (!room) throw new AppError('Sala no encontrada', 404, 'SALA_NOT_FOUND');

      const nextQuestion = new (require('../application/usecases/NextQuestionUseCase'))();
      const { questionForPlayers, questionForManager } = nextQuestion.execute({ partidaId });

      const io = SocketServer.getInstance()?.getIO();
      if (io) {
        io.to(`game:${room.codigoAcceso}`).emit('game:question', questionForPlayers);
        io.to(`game:${room.codigoAcceso}`).emit('game:question_manager', questionForManager);
      }

      const cooldownMs = (questionForPlayers.cooldown ?? 0) * 1000;
      if (cooldownMs > 0) {
        setTimeout(() => {
          const currentRoom = registry.findByPartidaId(partidaId);
          if (currentRoom && currentRoom.status === 'SHOW_QUESTION') {
            currentRoom.openAnswers();
            const io2 = SocketServer.getInstance()?.getIO();
            if (io2) {
              io2.to(`game:${room.codigoAcceso}`).emit('game:open_answers', {
                questionIndex: questionForPlayers.index,
              });
            }
          }
        }, cooldownMs);
      }

      logger.info('Siguiente pregunta ejecutada', { usuarioId, partidaId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en siguiente pregunta', { usuarioId, partidaId, error: error.message });
      throw error;
    }
  }

  async reconstructRoom(codigoAcceso) {
    logger.info('Reconstructing room from DB', { codigoAcceso });
    try {
      const partida = await prisma.tbl_t_partida.findUnique({
        where: { codigo_acceso: codigoAcceso, estado: true },
        include: {
          tbl_t_prueba: {
            include: {
              tbl_t_pregunta: {
                where: { estado: true },
                include: { tbl_t_opcion: { where: { estado: true }, orderBy: { orden: 'asc' } } },
              },
            },
          },
        },
      });

      if (!partida || (partida.estado_partida !== 'esperando' && partida.estado_partida !== 'en_curso')) {
        logger.warn('Cannot reconstruct room: invalid state', { codigoAcceso, estado: partida?.estado_partida });
        return null;
      }

      const prueba = {
        id_prueba: partida.tbl_t_prueba.id_prueba,
        titulo: partida.tbl_t_prueba.titulo,
        preguntas: partida.tbl_t_prueba.tbl_t_pregunta.map((p) => ({
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
        managerSocketId: null,
      });

      const registry = GameRegistry.getInstance();
      registry.register(room);
      new SQLiteGameRepository().saveRoom(room);

      logger.info('Room reconstructed and registered', { codigoAcceso, partidaId: partida.id_partida });
      return room;
    } catch (error) {
      logger.error('Error reconstructing room', { codigoAcceso, error: error.message });
      return null;
    }
  }
}

module.exports = new PartidaService();
