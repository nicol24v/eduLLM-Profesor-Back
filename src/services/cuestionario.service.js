const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const cuestionarioRepository = require('../repositories/cuestionario.repository');

const getProfesorOrFail = async (usuarioId) => {
  const profesor = await prisma.tbl_m_profesor.findUnique({
    where: { usuario_id: usuarioId, estado: true },
  });
  if (!profesor) throw new AppError('Profesor no encontrado', 404);
  return profesor;
};

/**
 * Verifica que el cuestionario pertenezca al profesor.
 */
const assertOwnership = async (pruebaId, profesor) => {
  const profesorMateriaIds = await prisma.tbl_t_profesor_materia
    .findMany({ where: { profesor_id: profesor.id_profesor, estado: true }, select: { id_profesor_materia: true } })
    .then((rows) => rows.map((r) => r.id_profesor_materia));

  const prueba = await prisma.tbl_t_prueba.findFirst({
    where: {
      id_prueba: pruebaId,
      profesor_materia_id: { in: profesorMateriaIds },
      estado: true,
    },
  });
  if (!prueba) throw new AppError('Cuestionario no encontrado o sin acceso', 404);
  return prueba;
};

const getAll = async (usuarioId, { page, limit, materia_id }) => {
  const profesor = await getProfesorOrFail(usuarioId);

  const profesorMateriasWhere = { profesor_id: profesor.id_profesor, estado: true };
  if (materia_id) profesorMateriasWhere.materia_id = materia_id;

  const profesorMaterias = await prisma.tbl_t_profesor_materia.findMany({
    where: profesorMateriasWhere,
    select: { id_profesor_materia: true },
  });
  const profesorMateriaIds = profesorMaterias.map((pm) => pm.id_profesor_materia);

  const skip = (page - 1) * limit;

  const [total, cuestionarios] = await Promise.all([
    prisma.tbl_t_prueba.count({
      where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
    }),
    prisma.tbl_t_prueba.findMany({
      where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true },
      include: {
        tbl_t_profesor_materia: {
          include: { tbl_m_materia: { select: { nombre: true } } },
        },
        _count: { select: { tbl_t_pregunta: { where: { estado: true } } } },
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: cuestionarios.map((c) => ({
      id_prueba: c.id_prueba,
      titulo: c.titulo,
      descripcion: c.descripcion,
      materia: c.tbl_t_profesor_materia?.tbl_m_materia?.nombre || null,
      total_preguntas: c._count.tbl_t_pregunta,
      configuracion: c.configuracion,
      fecha_creacion: c.fecha_creacion,
    })),
    meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
  };
};

const getById = async (usuarioId, pruebaId) => {
  const profesor = await getProfesorOrFail(usuarioId);
  await assertOwnership(pruebaId, profesor);

  const prueba = await cuestionarioRepository.findByIdWithPreguntas(pruebaId);
  return prueba;
};

const create = async (usuarioId, body) => {
  const profesor = await getProfesorOrFail(usuarioId);
  const { titulo, descripcion, profesor_materia_id, configuracion, preguntas = [] } = body;

  if (!titulo) throw new AppError('El título es requerido', 400);
  if (!profesor_materia_id) throw new AppError('El id de asignación materia-profesor es requerido', 400);
  if (preguntas.length < 1) throw new AppError('Se requiere al menos 1 pregunta', 400);
  if (preguntas.length > 20) throw new AppError('Máximo 20 preguntas permitidas', 400);

  // Verificar que la asignación pertenece al profesor
  const pm = await prisma.tbl_t_profesor_materia.findFirst({
    where: { id_profesor_materia: parseInt(profesor_materia_id, 10), profesor_id: profesor.id_profesor, estado: true },
  });
  if (!pm) throw new AppError('Asignación materia-profesor no válida', 400);

  // Validar que cada pregunta tenga al menos 2 opciones y exactamente 1 correcta
  for (const [i, pregunta] of preguntas.entries()) {
    if (!pregunta.texto) throw new AppError(`La pregunta ${i + 1} debe tener texto`, 400);
    const opciones = pregunta.opciones || [];
    if (opciones.length < 2) throw new AppError(`La pregunta ${i + 1} debe tener al menos 2 opciones`, 400);
    const correctas = opciones.filter((o) => o.es_correcta);
    if (correctas.length !== 1) throw new AppError(`La pregunta ${i + 1} debe tener exactamente 1 opción correcta`, 400);
  }

  const prueba = await prisma.$transaction(async (tx) => {
    const nuevaPrueba = await tx.tbl_t_prueba.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        configuracion: configuracion || null,
        profesor_materia_id: pm.id_profesor_materia,
        usuario_creacion: usuarioId,
      },
    });

    for (const pregunta of preguntas) {
      const nuevaPregunta = await tx.tbl_t_pregunta.create({
        data: {
          prueba_id: nuevaPrueba.id_prueba,
          texto: pregunta.texto,
          tipo: pregunta.tipo || 'single_choice',
          cooldown: pregunta.cooldown ?? 5,
          tiempo_limite: pregunta.tiempo_limite ?? 30,
          image_url: pregunta.image_url || null,
          audio_url: pregunta.audio_url || null,
          video_url: pregunta.video_url || null,
          usuario_creacion: usuarioId,
        },
      });

      for (const [idx, opcion] of (pregunta.opciones || []).entries()) {
        await tx.tbl_t_opcion.create({
          data: {
            pregunta_id: nuevaPregunta.id_pregunta,
            texto: opcion.texto,
            orden: opcion.orden ?? idx + 1,
            es_correcta: opcion.es_correcta ?? false,
            usuario_creacion: usuarioId,
          },
        });
      }
    }

    return nuevaPrueba;
  });

  return cuestionarioRepository.findByIdWithPreguntas(prueba.id_prueba);
};

const update = async (usuarioId, pruebaId, body) => {
  const profesor = await getProfesorOrFail(usuarioId);
  await assertOwnership(pruebaId, profesor);

  const { titulo, descripcion, configuracion, preguntas } = body;

  await prisma.$transaction(async (tx) => {
    await tx.tbl_t_prueba.update({
      where: { id_prueba: pruebaId },
      data: {
        ...(titulo && { titulo }),
        ...(descripcion !== undefined && { descripcion }),
        ...(configuracion !== undefined && { configuracion }),
        usuario_modificacion: usuarioId,
        fecha_modificacion: new Date(),
      },
    });

    if (preguntas && Array.isArray(preguntas)) {
      for (const pregunta of preguntas) {
        if (pregunta.id_pregunta) {
          // Actualizar pregunta existente
          await tx.tbl_t_pregunta.update({
            where: { id_pregunta: pregunta.id_pregunta },
            data: {
              texto: pregunta.texto,
              tipo: pregunta.tipo,
              cooldown: pregunta.cooldown,
              tiempo_limite: pregunta.tiempo_limite,
              image_url: pregunta.image_url || null,
              audio_url: pregunta.audio_url || null,
              video_url: pregunta.video_url || null,
              usuario_modificacion: usuarioId,
              fecha_modificacion: new Date(),
            },
          });

          if (pregunta.opciones && Array.isArray(pregunta.opciones)) {
            for (const opcion of pregunta.opciones) {
              if (opcion.id_opcion) {
                await tx.tbl_t_opcion.update({
                  where: { id_opcion: opcion.id_opcion },
                  data: {
                    texto: opcion.texto,
                    orden: opcion.orden,
                    es_correcta: opcion.es_correcta,
                  },
                });
              }
            }
          }
        } else {
          // Nueva pregunta
          const nuevaPregunta = await tx.tbl_t_pregunta.create({
            data: {
              prueba_id: pruebaId,
              texto: pregunta.texto,
              tipo: pregunta.tipo || 'single_choice',
              cooldown: pregunta.cooldown ?? 5,
              tiempo_limite: pregunta.tiempo_limite ?? 30,
              image_url: pregunta.image_url || null,
              audio_url: pregunta.audio_url || null,
              video_url: pregunta.video_url || null,
              usuario_creacion: usuarioId,
            },
          });

          for (const [idx, opcion] of (pregunta.opciones || []).entries()) {
            await tx.tbl_t_opcion.create({
              data: {
                pregunta_id: nuevaPregunta.id_pregunta,
                texto: opcion.texto,
                orden: opcion.orden ?? idx + 1,
                es_correcta: opcion.es_correcta ?? false,
                usuario_creacion: usuarioId,
              },
            });
          }
        }
      }
    }
  });

  return cuestionarioRepository.findByIdWithPreguntas(pruebaId);
};

const remove = async (usuarioId, pruebaId) => {
  const profesor = await getProfesorOrFail(usuarioId);
  await assertOwnership(pruebaId, profesor);

  await prisma.tbl_t_prueba.update({
    where: { id_prueba: pruebaId },
    data: { estado: false, usuario_modificacion: usuarioId, fecha_modificacion: new Date() },
  });
};

module.exports = { getAll, getById, create, update, remove };
