'use strict';

const prisma = require('../../config/prisma');

/**
 * Persists final game results to PostgreSQL (edu_llm) when a game finishes.
 */
class PrismaGameRepository {
  async finalizeGame(room) {
    const leaderboard = room.getLeaderboard();
    const partida = await prisma.tbl_t_partida.findUnique({
      where: { id_partida: room.partidaId },
      select: { usuario_creacion: true },
    });
    const usuarioCreacion = partida?.usuario_creacion ?? 0;

    const idPartidaEstudianteMap = {};

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

        const playerId = parseInt(entry.playerId, 10);
        const pe = await tx.tbl_t_partida_estudiante.findFirst({
          where: {
            partida_id: room.partidaId,
            estudiante_materia_id: playerId,
            estado: true,
          },
        });

        let partidaEstudianteId;
        if (pe) {
          await tx.tbl_t_partida_estudiante.update({
            where: { id_partida_estudiante: pe.id_partida_estudiante },
            data: {
              puntaje_total: entry.score,
              respuestas_correctas: entry.correctAnswers,
              fecha_modificacion: new Date(),
            },
          });
          partidaEstudianteId = pe.id_partida_estudiante;
        } else {
          const created = await tx.tbl_t_partida_estudiante.create({
            data: {
              partida_id: room.partidaId,
              nickname_opcional: entry.nickname,
              estudiante_materia_id: playerId,
              puntaje_total: entry.score,
              respuestas_correctas: entry.correctAnswers,
              usuario_creacion: usuarioCreacion,
            },
          });
          partidaEstudianteId = created.id_partida_estudiante;
        }

        idPartidaEstudianteMap[entry.playerId] = partidaEstudianteId;

        const player = room.getPlayer(entry.playerId);
        if (player && player.answerHistory.length > 0) {
          for (const answer of player.answerHistory) {
            await tx.tbl_t_respuesta.create({
              data: {
                partida_estudiante_id: partidaEstudianteId,
                pregunta_id: answer.preguntaId,
                opcion_seleccionada_id: answer.opcionId,
                puntaje_obtenido: answer.points,
                tiempo_ms: answer.elapsedMs,
                usuario_creacion: usuarioCreacion,
              },
            });
          }
        }
      }
    });

    return idPartidaEstudianteMap;
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
