class MateriaMapper {
  static toResponse(pm) {
    if (!pm) return null;
    return {
      id_profesor_materia: pm.id_profesor_materia,
      materia: {
        id_materia: pm.tbl_m_materia?.id_materia,
        nombre: pm.tbl_m_materia?.nombre,
        descripcion: pm.tbl_m_materia?.descripcion,
        grado: pm.tbl_m_materia?.tbl_m_grado
          ? `${pm.tbl_m_materia.tbl_m_grado.grado}${pm.tbl_m_materia.tbl_m_grado.paralelo}`
          : null,
      },
      periodo: pm.tbl_m_periodo_lectivo?.nombre,
      es_activo: pm.tbl_m_periodo_lectivo?.es_activo,
    };
  }

  static toResponseWithCounts(pm, totalEstudiantes, totalCuestionarios) {
    const base = this.toResponse(pm);
    return {
      ...base,
      total_estudiantes: totalEstudiantes,
      total_cuestionarios: totalCuestionarios,
    };
  }

  static toDetailResponse(pm, estudiantes) {
    if (!pm) return null;
    return {
      id_profesor_materia: pm.id_profesor_materia,
      materia: {
        id_materia: pm.tbl_m_materia?.id_materia,
        nombre: pm.tbl_m_materia?.nombre,
        descripcion: pm.tbl_m_materia?.descripcion,
        grado: pm.tbl_m_materia?.tbl_m_grado
          ? `${pm.tbl_m_materia.tbl_m_grado.grado}${pm.tbl_m_materia.tbl_m_grado.paralelo}`
          : null,
      },
      periodo: pm.tbl_m_periodo_lectivo
        ? {
            nombre: pm.tbl_m_periodo_lectivo.nombre,
            fecha_inicio: pm.tbl_m_periodo_lectivo.fecha_inicio,
            fecha_fin: pm.tbl_m_periodo_lectivo.fecha_fin,
            es_activo: pm.tbl_m_periodo_lectivo.es_activo,
          }
        : null,
      estudiantes: (estudiantes || []).map((e) => ({
        id_estudiante_materia: e.id_estudiante_materia,
        nombre: e.tbl_m_estudiante?.tbl_m_usuario?.primer_nombre,
        apellido: e.tbl_m_estudiante?.tbl_m_usuario?.apellido_paterno,
        correo: e.tbl_m_estudiante?.tbl_m_usuario?.correo,
      })),
    };
  }

  static toResponseList(profesorMaterias) {
    return profesorMaterias.map((pm) => this.toResponse(pm));
  }
}

module.exports = MateriaMapper;
