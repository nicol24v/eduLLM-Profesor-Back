'use strict';

const prisma = require('../../config/prisma');

/**
 * Persists final game results to PostgreSQL (edu_llm) when a game finishes.
 */
class PrismaGameRepository {
  async finalizeGame(room) {
    const leaderboard = room.getLeaderboard();

    await prisma.$transaction(async (tx) => {
      await tx.tbl_t_partida.update({
        where: { id_partida: room.partidaId },
        data: {
          estado_partida: 'finalizada',
          finalizado_en: new Date(),
          fecha_modificacion: new Date(),
        },
      });

      for (const entry of leaderboard) {
        if (!entry.playerId) continue;

        const pe = await tx.tbl_t_partida_estudiante.findFirst({
          where: {
            partida_id: room.partidaId,
            estudiante_materia_id: parseInt(entry.playerId, 10),
            estado: true,
          },
        });

        if (pe) {
          await tx.tbl_t_partida_estudiante.update({
            where: { id_partida_estudiante: pe.id_partida_estudiante },
            data: {
              puntaje_total: entry.score,
              respuestas_correctas: entry.correctAnswers,
              fecha_modificacion: new Date(),
            },
          });
        } else {
          await tx.tbl_t_partida_estudiante.create({
            data: {
              partida_id: room.partidaId,
              nickname_opcional: entry.nickname,
              puntaje_total: entry.score,
              respuestas_correctas: entry.correctAnswers,
              usuario_creacion: 0,
            },
          });
        }
      }
    });
  }

  async findPruebaForGame(pruebaId) {
    return prisma.tbl_t_prueba.findUnique({
      where: { id_prueba: pruebaId, estado: true },
      include: {
        tbl_t_pregunta: {
          where: { estado: true },
          orderBy: { id_pregunta: 'asc' },
          include: {
            tbl_t_opcion: {
              where: { estado: true },
              orderBy: { orden: 'asc' },
            },
          },
        },
      },
    });
  }

  async markPartidaInProgress(partidaId, usuarioId) {
    return prisma.tbl_t_partida.update({
      where: { id_partida: partidaId },
      data: {
        estado_partida: 'en_curso',
        iniciado_en: new Date(),
        usuario_modificacion: usuarioId,
        fecha_modificacion: new Date(),
      },
    });
  }
}

module.exports = PrismaGameRepository;
