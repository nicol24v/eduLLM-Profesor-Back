const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const getProfesorOrFail = async (usuarioId) => {
  const profesor = await prisma.tbl_m_profesor.findUnique({
    where: { usuario_id: usuarioId, estado: true },
  });
  if (!profesor) throw new AppError('Profesor no encontrado', 404);
  return profesor;
};

const getMaterias = async (usuarioId) => {
  const profesor = await getProfesorOrFail(usuarioId);

  const profesorMaterias = await prisma.tbl_t_profesor_materia.findMany({
    where: { profesor_id: profesor.id_profesor, estado: true },
    include: {
      tbl_m_materia: {
        include: { tbl_m_grado: { select: { grado: true, paralelo: true } } },
      },
      tbl_m_periodo_lectivo: { select: { nombre: true, es_activo: true } },
    },
    orderBy: { fecha_asignacion: 'desc' },
  });

  const result = await Promise.all(
    profesorMaterias.map(async (pm) => {
      const totalEstudiantes = await prisma.tbl_m_estudiante_materia.count({
        where: { id_materia: pm.materia_id, estado: true },
      });
      const totalCuestionarios = await prisma.tbl_t_prueba.count({
        where: { profesor_materia_id: pm.id_profesor_materia, estado: true },
      });
      return {
        id_profesor_materia: pm.id_profesor_materia,
        materia: {
          id_materia: pm.tbl_m_materia.id_materia,
          nombre: pm.tbl_m_materia.nombre,
          descripcion: pm.tbl_m_materia.descripcion,
          grado: pm.tbl_m_materia.tbl_m_grado
            ? `${pm.tbl_m_materia.tbl_m_grado.grado}${pm.tbl_m_materia.tbl_m_grado.paralelo}`
            : null,
        },
        periodo: pm.tbl_m_periodo_lectivo.nombre,
        es_activo: pm.tbl_m_periodo_lectivo.es_activo,
        total_estudiantes: totalEstudiantes,
        total_cuestionarios: totalCuestionarios,
      };
    }),
  );

  return result;
};

const getMateriaById = async (usuarioId, profesorMateriaId) => {
  const profesor = await getProfesorOrFail(usuarioId);

  const pm = await prisma.tbl_t_profesor_materia.findFirst({
    where: {
      id_profesor_materia: profesorMateriaId,
      profesor_id: profesor.id_profesor,
      estado: true,
    },
    include: {
      tbl_m_materia: {
        include: { tbl_m_grado: { select: { grado: true, paralelo: true } } },
      },
      tbl_m_periodo_lectivo: true,
    },
  });

  if (!pm) throw new AppError('Materia no encontrada o sin acceso', 404);

  const estudiantes = await prisma.tbl_m_estudiante_materia.findMany({
    where: { id_materia: pm.materia_id, estado: true },
    include: {
      tbl_m_estudiante: {
        include: {
          tbl_m_usuario: {
            select: { primer_nombre: true, segundo_nombre: true, apellido_paterno: true, correo: true },
          },
        },
      },
    },
  });

  return {
    id_profesor_materia: pm.id_profesor_materia,
    materia: {
      id_materia: pm.tbl_m_materia.id_materia,
      nombre: pm.tbl_m_materia.nombre,
      descripcion: pm.tbl_m_materia.descripcion,
      grado: pm.tbl_m_materia.tbl_m_grado
        ? `${pm.tbl_m_materia.tbl_m_grado.grado}${pm.tbl_m_materia.tbl_m_grado.paralelo}`
        : null,
    },
    periodo: {
      nombre: pm.tbl_m_periodo_lectivo.nombre,
      fecha_inicio: pm.tbl_m_periodo_lectivo.fecha_inicio,
      fecha_fin: pm.tbl_m_periodo_lectivo.fecha_fin,
      es_activo: pm.tbl_m_periodo_lectivo.es_activo,
    },
    estudiantes: estudiantes.map((e) => ({
      id_estudiante_materia: e.id_estudiante_materia,
      nombre: e.tbl_m_estudiante.tbl_m_usuario.primer_nombre,
      apellido: e.tbl_m_estudiante.tbl_m_usuario.apellido_paterno,
      correo: e.tbl_m_estudiante.tbl_m_usuario.correo,
    })),
  };
};

module.exports = { getMaterias, getMateriaById };
