const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const CuestionarioRepository = require('../repositories/cuestionario.repository');
const CuestionarioMapper = require('../mappers/cuestionario.mapper');

class CuestionarioService {
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

  async #assertOwnership(pruebaId, profesor) {
    logger.debug('Asserting cuestionario ownership', { pruebaId, profesorId: profesor.id_profesor });
    const profesorMateriaIds = await CuestionarioRepository.findProfesorMateriasIds(profesor.id_profesor);

    const prueba = await prisma.tbl_t_prueba.findFirst({
      where: {
        id_prueba: pruebaId,
        profesor_materia_id: { in: profesorMateriaIds },
        estado: true,
      },
    });
    if (!prueba) {
      logger.warn('Cuestionario ownership assertion failed', { pruebaId, profesorId: profesor.id_profesor });
      throw new AppError('Cuestionario no encontrado o sin acceso', 404, 'CUESTIONARIO_NOT_FOUND');
    }
    return prueba;
  }

  async #findActiveProfesorMateria(profesorId, materiaId) {
    const pm = await prisma.tbl_t_profesor_materia.findFirst({
      where: {
        profesor_id: profesorId,
        materia_id: parseInt(materiaId, 10),
        estado: true,
        tbl_m_periodo_lectivo: { es_activo: true },
      },
    });
    if (!pm) {
      throw new AppError(
        'No tienes una asignación activa para esta materia en el período actual',
        400,
        'NO_ACTIVE_ASSIGNMENT',
      );
    }
    return pm;
  }

  async getAll(usuarioId, { page, limit, materia_id }) {
    logger.info('Fetching cuestionarios', { usuarioId, page, limit, materia_id });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      const profesorMateriaIds = await CuestionarioRepository.findProfesorMateriasIds(
        profesor.id_profesor,
        materia_id,
      );

      if (profesorMateriaIds.length === 0) {
        return CuestionarioMapper.toListResponse([], { total: 0, page, limit, total_pages: 0 });
      }

      const skip = (page - 1) * limit;
      const [total, cuestionarios] = await Promise.all([
        CuestionarioRepository.countByMateriaIds(profesorMateriaIds),
        CuestionarioRepository.findPaginated(profesorMateriaIds, skip, limit),
      ]);

      logger.info('Cuestionarios fetched', { usuarioId, total, page, limit });
      return CuestionarioMapper.toListResponse(cuestionarios, {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching cuestionarios', { usuarioId, error: error.message });
      throw error;
    }
  }

  async getById(usuarioId, pruebaId) {
    logger.info('Fetching cuestionario by id', { usuarioId, pruebaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertOwnership(pruebaId, profesor);
      const prueba = await CuestionarioRepository.findByIdWithPreguntas(pruebaId);
      logger.info('Cuestionario fetched by id', { usuarioId, pruebaId });
      return CuestionarioMapper.toDetailResponse(prueba);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching cuestionario by id', { usuarioId, pruebaId, error: error.message });
      throw error;
    }
  }

  async create(usuarioId, body) {
    const { esIA, materia_id, title, titulo, descripcion, configuracion } = body;
    const finalQuestions = this.#normalizeQuestions(body);
    const finalTitle = title || titulo;
    logger.info('Creating cuestionario', { usuarioId, materia_id, esIA, title: finalTitle, questionsCount: finalQuestions.length });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      if (!materia_id) throw new AppError('El id de la materia es requerido', 400, 'MATERIA_ID_REQUIRED');
      if (!finalTitle) throw new AppError('El campo "title" es requerido', 400, 'TITLE_REQUIRED');
      if (finalQuestions.length < 1) throw new AppError('Se requiere al menos 1 pregunta', 400, 'MIN_PREGUNTAS');
      if (finalQuestions.length > 20) throw new AppError('Máximo 20 preguntas permitidas', 400, 'MAX_PREGUNTAS');

      const pm = await this.#findActiveProfesorMateria(profesor.id_profesor, materia_id);

      let createDescripcion = descripcion || (esIA ? 'IA' : null);

      for (const [i, q] of finalQuestions.entries()) {
        const num = i + 1;
        if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
          throw new AppError(`La pregunta ${num} debe tener texto`, 400, 'PREGUNTA_TEXTO_REQUIRED');
        }
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw new AppError(`La pregunta ${num} debe tener al menos 2 respuestas`, 400, 'MIN_OPCIONES');
        }
        if (!Array.isArray(q.solutions) || q.solutions.length < 1) {
          throw new AppError(`La pregunta ${num} debe tener al menos 1 respuesta correcta`, 400, 'UNA_CORRECTA');
        }
        for (const solutionIdx of q.solutions) {
          if (typeof solutionIdx !== 'number' || solutionIdx < 0 || solutionIdx >= q.options.length) {
            throw new AppError(`El índice de solución de la pregunta ${num} es inválido`, 400, 'SOLUCION_INVALIDA');
          }
        }
        if (typeof q.time !== 'number' || q.time <= 0) {
          throw new AppError(`La pregunta ${num} debe tener un tiempo límite válido`, 400, 'TIEMPO_INVALIDO');
        }
        if (typeof q.cooldown !== 'number' || q.cooldown < 0 || !Number.isInteger(q.cooldown)) {
          throw new AppError(`La pregunta ${num} debe tener un cooldown válido`, 400, 'COOLDOWN_INVALIDO');
        }
      }

      const prueba = await prisma.$transaction(async (tx) => {
        const nuevaPrueba = await tx.tbl_t_prueba.create({
          data: {
            titulo: finalTitle,
            descripcion: createDescripcion || null,
            configuracion: configuracion || null,
            profesor_materia_id: pm.id_profesor_materia,
            usuario_creacion: profesor.usuario_id,
          },
        });

        for (const q of finalQuestions) {
          const correctIdx = q.solutions[0];
          const nuevaPregunta = await tx.tbl_t_pregunta.create({
            data: {
              prueba_id: nuevaPrueba.id_prueba,
              texto: q.question.trim(),
              tipo: 'single_choice',
              cooldown: q.cooldown,
              tiempo_limite: q.time,
              image_url: q.image || null,
              usuario_creacion: profesor.usuario_id,
            },
          });

          for (const [idx, texto] of q.options.entries()) {
            await tx.tbl_t_opcion.create({
              data: {
                pregunta_id: nuevaPregunta.id_pregunta,
                texto,
                orden: idx + 1,
                es_correcta: idx === correctIdx,
                retroalimentacion: q.feedback ? q.feedback[idx] : null,
                usuario_creacion: profesor.usuario_id,
              },
            });
          }
        }

        return nuevaPrueba;
      });

      logger.info('Cuestionario created', { usuarioId, pruebaId: prueba.id_prueba, preguntasCount: finalQuestions.length, esIA: !!esIA, descripcion: createDescripcion });
      return CuestionarioRepository.findByIdWithPreguntas(prueba.id_prueba);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating cuestionario', { usuarioId, error: error.message });
      throw error;
    }
  }

  #normalizeQuestions(body) {
    if (body.questions) return body.questions;
    if (!body.preguntas) return [];
    return body.preguntas.map((p) => {
      const correctIdx = (p.opciones || []).findIndex((o) => o.es_correcta);
      const n = {
        question: p.texto,
        options: (p.opciones || []).map((o) => o.texto),
        feedback: (p.opciones || []).map((o) => o.retroalimentacion || null),
        solutions: correctIdx >= 0 ? [correctIdx] : [0],
        cooldown: p.cooldown ?? 5,
        time: p.tiempo_limite ?? 30,
        image: p.image_url || null,
      };
      if (p.id_pregunta) n.id = p.id_pregunta;
      return n;
    });
  }

  async update(usuarioId, pruebaId, body) {
    logger.info('Updating cuestionario', { usuarioId, pruebaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertOwnership(pruebaId, profesor);

      const { title, titulo, descripcion, configuracion } = body;
      const questions = this.#normalizeQuestions(body);

      await prisma.$transaction(async (tx) => {
        await tx.tbl_t_prueba.update({
          where: { id_prueba: pruebaId },
          data: {
            ...((title || titulo) && { titulo: title || titulo }),
            ...(descripcion !== undefined && { descripcion }),
            ...(configuracion !== undefined && { configuracion }),
            usuario_modificacion: profesor.usuario_id,
            fecha_modificacion: new Date(),
          },
        });

        if (questions && Array.isArray(questions)) {
          const incomingIds = questions.filter((q) => q.id).map((q) => q.id);

          if (incomingIds.length > 0) {
            await tx.tbl_t_opcion.updateMany({
              where: { tbl_t_pregunta: { prueba_id: pruebaId, id_pregunta: { notIn: incomingIds } } },
              data: { estado: false },
            });
            await tx.tbl_t_pregunta.updateMany({
              where: { prueba_id: pruebaId, id_pregunta: { notIn: incomingIds } },
              data: { estado: false, usuario_modificacion: profesor.usuario_id, fecha_modificacion: new Date() },
            });
          } else {
            await tx.tbl_t_opcion.updateMany({
              where: { pregunta: { prueba_id: pruebaId } },
              data: { estado: false },
            });
            await tx.tbl_t_pregunta.updateMany({
              where: { prueba_id: pruebaId },
              data: { estado: false, usuario_modificacion: profesor.usuario_id, fecha_modificacion: new Date() },
            });
          }

          for (const q of questions) {
            if (q.id) {
              const correctIdx = q.solutions ? q.solutions[0] : 0;
              await tx.tbl_t_pregunta.update({
                where: { id_pregunta: q.id },
                data: {
                  texto: q.question,
                  cooldown: q.cooldown,
                  tiempo_limite: q.time,
                  image_url: q.image || null,
                  usuario_modificacion: profesor.usuario_id,
                  fecha_modificacion: new Date(),
                },
              });

              if (q.options && Array.isArray(q.options)) {
                await tx.tbl_t_opcion.updateMany({
                  where: { pregunta_id: q.id },
                  data: { estado: false },
                });

                for (const [idx, texto] of q.options.entries()) {
                  await tx.tbl_t_opcion.create({
                    data: {
                      pregunta_id: q.id,
                      texto,
                      orden: idx + 1,
                      es_correcta: idx === correctIdx,
                      retroalimentacion: q.feedback ? q.feedback[idx] : null,
                      usuario_creacion: profesor.usuario_id,
                    },
                  });
                }
              }
            } else {
              const correctIdx = q.solutions ? q.solutions[0] : 0;
              const nuevaPregunta = await tx.tbl_t_pregunta.create({
                data: {
                  prueba_id: pruebaId,
                  texto: q.question.trim(),
                  tipo: 'single_choice',
                  cooldown: q.cooldown ?? 5,
                  tiempo_limite: q.time ?? 30,
                  image_url: q.image || null,
                  usuario_creacion: profesor.usuario_id,
                },
              });

              for (const [idx, texto] of (q.options || []).entries()) {
                await tx.tbl_t_opcion.create({
                  data: {
                    pregunta_id: nuevaPregunta.id_pregunta,
                    texto,
                    orden: idx + 1,
                    es_correcta: idx === correctIdx,
                    retroalimentacion: q.feedback ? q.feedback[idx] : null,
                    usuario_creacion: profesor.usuario_id,
                  },
                });
              }
            }
          }
        }
      });

      logger.info('Cuestionario updated', { usuarioId, pruebaId });
      return CuestionarioRepository.findByIdWithPreguntas(pruebaId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating cuestionario', { usuarioId, pruebaId, error: error.message });
      throw error;
    }
  }

  async remove(usuarioId, pruebaId) {
    logger.info('Removing cuestionario', { usuarioId, pruebaId });
    try {
      const profesor = await this.#getProfesorOrFail(usuarioId);
      await this.#assertOwnership(pruebaId, profesor);

      await prisma.tbl_t_prueba.update({
        where: { id_prueba: pruebaId },
        data: { estado: false, usuario_modificacion: profesor.usuario_id, fecha_modificacion: new Date() },
      });

      logger.info('Cuestionario removed', { usuarioId, pruebaId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error removing cuestionario', { usuarioId, pruebaId, error: error.message });
      throw error;
    }
  }
}

module.exports = new CuestionarioService();
