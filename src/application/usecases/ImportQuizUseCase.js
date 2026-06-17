'use strict';

const prisma = require('../../config/prisma');
const QuizValidator = require('../../domain/quiz/QuizValidator');
const QuizImporter = require('../../domain/quiz/QuizImporter');
const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');

class ImportQuizUseCase {
  #validator;
  #importer;

  constructor() {
    this.#validator = new QuizValidator();
    this.#importer = new QuizImporter();
  }

  async execute({ pregunta: mindbuzzJson, origen, usuarioId }) {
    logger.info('UseCase: ImportQuiz', { usuarioId, origen });
    try {
      if (!mindbuzzJson || typeof mindbuzzJson !== 'object') {
        throw new AppError('El cuerpo de la solicitud debe contener un objeto JSON con "subject" y "questions"', 400, 'INVALID_BODY');
      }
      if (!['IA', 'MANUAL'].includes(origen)) {
        throw new AppError('El campo "origen" debe ser "IA" o "MANUAL"', 400, 'INVALID_ORIGEN');
      }

      this.#validator.validate(mindbuzzJson);

      const profesor = await prisma.tbl_m_profesor.findUnique({
        where: { usuario_id: usuarioId, estado: true },
      });
      if (!profesor) throw new AppError('Profesor no encontrado', 404, 'PROFESOR_NOT_FOUND');

      const { pruebaData, preguntasData } = this.#importer.transform(mindbuzzJson, {
        origen,
        usuarioId,
        profesorMateriaId: null,
      });

      const prueba = await prisma.$transaction(async (tx) => {
        const nuevaPrueba = await tx.tbl_t_prueba.create({
          data: {
            titulo: pruebaData.titulo,
            configuracion: pruebaData.configuracion,
            usuario_creacion: usuarioId,
          },
        });

        for (const preguntaData of preguntasData) {
          const { opciones, ...preguntaFields } = preguntaData;
          const nuevaPregunta = await tx.tbl_t_pregunta.create({
            data: { ...preguntaFields, prueba_id: nuevaPrueba.id_prueba },
          });

          for (const opcion of opciones) {
            await tx.tbl_t_opcion.create({
              data: { ...opcion, pregunta_id: nuevaPregunta.id_pregunta },
            });
          }
        }

        return nuevaPrueba;
      });

      logger.info('UseCase: ImportQuiz completed', { usuarioId, pruebaId: prueba.id_prueba, totalPreguntas: preguntasData.length });

      return {
        id_prueba: prueba.id_prueba,
        titulo: prueba.titulo,
        total_preguntas: preguntasData.length,
        origen,
        fecha_creacion: prueba.fecha_creacion,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('UseCase: ImportQuiz error', { usuarioId, error: error.message });
      throw error;
    }
  }
}

module.exports = ImportQuizUseCase;
