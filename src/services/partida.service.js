const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateAccessCode } = require('../utils/codeGenerator');
const partidaRepository = require('../repositories/partida.repository');

const getProfesorOrFail = async (usuarioId) => {
  const profesor = await prisma.tbl_m_profesor.findUnique({
    where: { usuario_id: usuarioId, estado: true },
  });
  if (!profesor) throw new AppError('Profesor no encontrado', 404);
  return profesor;
};

const assertPartidaOwnership = async (partidaId, profesor) => {
  const profesorMateriaIds = await prisma.tbl_t_profesor_materia
    .findMany({ where: { profesor_id: profesor.id_profesor, estado: true }, select: { id_profesor_materia: true } })
    .then((rows) => rows.map((r) => r.id_profesor_materia));

  const pruebasIds = await prisma.tbl_t_prueba
    .findMany({ where: { profesor_materia_id: { in: profesorMateriaIds }, estado: true }, select: { id_prueba: true } })
    .then((rows) => rows.map((r) => r.id_prueba));

  const partida = await prisma.tbl_t_partida.findFirst({
    where: { id_partida: partidaId, prueba_id: { in: pruebasIds }, estado: true },
    include: { tbl_t_prueba: { include: { tbl_t_pregunta: { where: { estado: true }, orderBy: { id_pregunta: 'asc' } } } } },
  });
  if (!partida) throw new AppError('Partida no encontrada o sin acceso', 404);
  return partida;
};

const getHistory = async (usuarioId, { page, limit, prueba_id }) => {
  const profesor = await getProfesorOrFail(usuarioId);

  const profesorMateriaIds = await prisma.tbl_t_profesor_materia
    .findMany({ where: { profesor_id: profesor.id_profesor, estado: true }, select: { id_profesor_materia: true } })
    .then((rows) => rows.map((r) => r.id_profesor_materia));

  const pruebasWhere = { profesor_materia_id: { in: profesorMateriaIds }, estado: true };
  if (prueba_id) pruebasWhere.id_prueba = prueba_id;

  const pruebasIds = await prisma.tbl_t_prueba
    .findMany({ where: pruebasWhere, select: { id_prueba: true } })
    .then((rows) => rows.map((r) => r.id_prueba));

  const skip = (page - 1) * limit;

  const [total, partidas] = await Promise.all([
    prisma.tbl_t_partida.count({ where: { prueba_id: { in: pruebasIds }, estado: true } }),
    prisma.tbl_t_partida.findMany({
      where: { prueba_id: { in: pruebasIds }, estado: true },
      include: {
        tbl_t_prueba: { select: { titulo: true } },
        _count: { select: { tbl_t_partida_estudiante: { where: { estado: true } } } },
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: partidas.map((p) => ({
      id_partida: p.id_partida,
      codigo_acceso: p.codigo_acceso,
      estado_partida: p.estado_partida,
      titulo_prueba: p.tbl_t_prueba.titulo,
      total_participantes: p._count.tbl_t_partida_estudiante,
      iniciado_en: p.iniciado_en,
      finalizado_en: p.finalizado_en,
      fecha_creacion: p.fecha_creacion,
    })),
    meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
  };
};

const getById = async (usuarioId, partidaId) => {
  const profesor = await getProfesorOrFail(usuarioId);
  return assertPartidaOwnership(partidaId, profesor);
};

const create = async (usuarioId, body) => {
  const profesor = await getProfesorOrFail(usuarioId);
  const { prueba_id } = body;

  if (!prueba_id) throw new AppError('El prueba_id es requerido', 400);

  // Verificar que la prueba pertenece al profesor
  const profesorMateriaIds = await prisma.tbl_t_profesor_materia
    .findMany({ where: { profesor_id: profesor.id_profesor, estado: true }, select: { id_profesor_materia: true } })
    .then((rows) => rows.map((r) => r.id_profesor_materia));

  const prueba = await prisma.tbl_t_prueba.findFirst({
    where: { id_prueba: parseInt(prueba_id, 10), profesor_materia_id: { in: profesorMateriaIds }, estado: true },
    include: { tbl_t_pregunta: { where: { estado: true } } },
  });
  if (!prueba) throw new AppError('Cuestionario no encontrado o sin acceso', 404);
  if (prueba.tbl_t_pregunta.length === 0) throw new AppError('El cuestionario no tiene preguntas', 400);

  // Generar código único con reintentos
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
  if (!codigoAcceso) throw new AppError('No se pudo generar un código único, intente de nuevo', 500);

  const partida = await prisma.tbl_t_partida.create({
    data: {
      prueba_id: prueba.id_prueba,
      codigo_acceso: codigoAcceso,
      estado_partida: 'esperando',
      usuario_creacion: usuarioId,
    },
    include: { tbl_t_prueba: { select: { titulo: true } } },
  });

  return {
    id_partida: partida.id_partida,
    codigo_acceso: partida.codigo_acceso,
    estado_partida: partida.estado_partida,
    titulo_prueba: partida.tbl_t_prueba.titulo,
    total_preguntas: prueba.tbl_t_pregunta.length,
    fecha_creacion: partida.fecha_creacion,
  };
};

const getResultados = async (usuarioId, partidaId) => {
  const profesor = await getProfesorOrFail(usuarioId);
  await assertPartidaOwnership(partidaId, profesor);

  return partidaRepository.findResultados(partidaId);
};

const getRanking = async (usuarioId, partidaId) => {
  const profesor = await getProfesorOrFail(usuarioId);
  await assertPartidaOwnership(partidaId, profesor);

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

  return participaciones.map((p, idx) => {
    const usuario = p.tbl_m_estudiante_materia?.tbl_m_estudiante?.tbl_m_usuario;
    return {
      posicion: idx + 1,
      id_partida_estudiante: p.id_partida_estudiante,
      nombre: usuario
        ? `${usuario.primer_nombre} ${usuario.apellido_paterno}`
        : p.nickname_opcional || 'Anónimo',
      puntaje_total: p.puntaje_total,
      respuestas_correctas: p.respuestas_correctas,
    };
  });
};

module.exports = { getHistory, getById, create, getResultados, getRanking };
