import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorPage({ user, onLogout }) {
  const [campañas, setCampañas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [seleccion, setSeleccion] = useState({
    campana_id: "",
    grupo_id: "",
    curso_id: "",
  });
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  const fechaHoy = new Date().toISOString().split("T")[0];
  const fechaHoyFormateada = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  console.log("Componente FormadorPage renderizado. User:", user); // Log 1

  useEffect(() => {
    console.log("useEffect inicial ejecutado"); // Log 2
    cargarDatos();
  }, []); // Se ejecuta una vez al montar

  const cargarDatos = async () => {
    console.log("Iniciando carga de datos general..."); // Log 3
    setLoading(true);
    try {
      await Promise.all([cargarCampañas(), cargarActivos()]);
      console.log("Carga de datos general completada."); // Log 4
    } catch (err) {
      console.error("Error en la carga general de datos:", err); // Log 5
      mostrarMensaje("error", "Error al cargar datos iniciales.");
    } finally {
      setLoading(false);
      console.log("Finalizado estado de carga general (loading = false)."); // Log 6
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    console.log("Mostrando mensaje:", tipo, texto); // Log 7
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  const cargarCampañas = async () => {
    console.log("Iniciando carga de campañas..."); // Log 8
    const { data, error } = await supabase.from("campañas").select("*");
    if (!error) {
      setCampañas(data || []);
      console.log("Campañas cargadas:", data); // Log 9
    } else {
      console.error("Error al cargar campañas:", error); // Log 10
      setCampañas([]);
      mostrarMensaje("error", "Error al cargar campañas");
    }
  };

  const cargarGrupos = async (campana_id) => {
  if (!campana_id) {
    console.log("No se proporcionó campana_id, omitiendo carga de grupos.");
    return;
  }
  console.log("Iniciando carga de grupos para campana_id:", campana_id);
  setLoading(true);

  try {
    // Cargar grupos sin relación
    const { data: gruposData, error: gruposError } = await supabase
      .from("grupos")
      .select("*")
      .eq("campana_id", campana_id);

    if (gruposError) {
      console.error("Error cargando grupos:", gruposError);
      setGrupos([]);
      return;
    }

    // Para cada grupo, contar usuarios por grupo_nombre
    const gruposConConteo = await Promise.all(
      gruposData.map(async (g) => {
        const { count } = await supabase
          .from("usuarios")
          .select("*", { count: "exact", head: true })
          .eq("grupo_nombre", g.nombre) // ← Usa el nombre del grupo
          .eq("rol", "Usuario")
          .eq("estado", "Activo");

        return {
          ...g,
          activos: count || 0
        };
      })
    );

    setGrupos(gruposConConteo);
    console.log("Grupos cargados y procesados:", gruposConConteo);

  } catch (err) {
    console.error("Error *interno* en cargarGrupos:", err);
    setGrupos([]);
  } finally {
    setLoading(false);
    console.log("Finalizado estado de carga de grupos (loading = false).");
  }
};

  const cargarCursos = async (campana_id, grupo_id) => {
    if (!campana_id || !grupo_id) {
        console.log("Falta campana_id o grupo_id, omitiendo carga de cursos."); // Log 17
        return;
    }
    console.log("Iniciando carga de cursos para campana_id:", campana_id, "grupo_id:", grupo_id); // Log 18
    setLoading(true);
    try {
      let query = supabase
        .from("cursos")
        .select("*")
        .eq("campana_id", campana_id)
        .eq("estado", "Activo");

      if (grupo_id) {
        query = query.or(`grupo_id.is.null,grupo_id.eq.${grupo_id}`);
      }

      const { data, error } = await query;
      if (!error) {
        setCursos(data || []);
        console.log("Cursos cargados:", data); // Log 19
      } else {
        console.error("Error al cargar cursos:", error); // Log 20
        setCursos([]);
        mostrarMensaje("error", "Error al cargar cursos");
      }
    } catch (err) {
      console.error("Error *interno* en cargarCursos:", err); // Log 21
      setCursos([]);
    } finally {
      setLoading(false);
      console.log("Finalizado estado de carga de cursos (loading = false)."); // Log 22
    }
  };

  const cargarActivos = async () => {
    console.log("Iniciando carga de cursos activos para user.id:", user?.id); // Log 23
    if (!user?.id) {
        console.error("User no está definido o no tiene ID. No se pueden cargar activos."); // Log 24
        setActivos([]);
        return;
    }
    const { data, error } = await supabase
      .from("cursos_activados")
      .select(`
        id, 
        curso_id, 
        campana_id, 
        grupo_id, 
        fecha, 
        activo,
        cursos(titulo, duracion_minutos),
        grupos(nombre),
        campañas(nombre)
      `)
      .eq("fecha", fechaHoy)
      .eq("formador_id", user.id);

    if (error) {
        console.error("Error al cargar cursos activos:", error); // Log 25
        setActivos([]);
        return;
    }

    if (!data) {
        console.warn("No se encontraron datos de cursos activos para hoy."); // Log 26
        setActivos([]);
        return;
    }

    console.log("Cursos activos raw:", data); // Log 27

    try {
      const activosConConteo = await Promise.all(
        data.map(async (activado) => {
          console.log("Contando asesores para curso_activado_id:", activado.id); // Log 28
          const { count } = await supabase
            .from("cursos_asesores")
            .select("*", { count: "exact", head: true })
            .eq("curso_activado_id", activado.id);

          console.log("Conteo para id", activado.id, ":", count); // Log 29
          return { ...activado, asesores_count: count || 0 };
        })
      );
      setActivos(activosConConteo);
      console.log("Cursos activos con conteo:", activosConConteo); // Log 30
    } catch (err) {
        console.error("Error contando asesores:", err); // Log 31
        setActivos(data.map(a => ({...a, asesores_count: 0}))); // Fallback
    }
  };

 const activarCurso = async () => {
  const { campana_id, grupo_id, curso_id } = seleccion;
  console.log("Intentando activar curso con selección:", seleccion);

  if (!campana_id || !grupo_id || !curso_id) {
    mostrarMensaje("error", "⚠️ Debes seleccionar campaña, grupo y curso");
    return;
  }

  setLoading(true);
  console.log("Iniciando proceso de activación...");

  try {
    // Verificar si ya está activado
    const {  existe } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("fecha", fechaHoy)
      .eq("campana_id", campana_id)
      .eq("grupo_id", grupo_id)
      .eq("curso_id", curso_id)
      .maybeSingle();

    if (existe) {
      console.log("Curso ya activado hoy para esta combinación.");
      mostrarMensaje("error", "⚠️ Este curso ya está activado hoy para esa campaña y grupo");
      return;
    }

    // Activar el curso
    const {  activacion, error } = await supabase
      .from("cursos_activados")
      .insert([
        {
          campana_id,
          grupo_id,
          curso_id,
          fecha: fechaHoy,
          activo: true,
          formador_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error al insertar curso activado:", error);
      mostrarMensaje("error", "❌ Error al activar el curso");
      return;
    }
    console.log("Curso activado en DB:", activacion);

    // Obtener el nombre del grupo para filtrar usuarios
    const {  grupo, error: errGrupo } = await supabase
      .from("grupos")
      .select("nombre") // Asumiendo que el campo se llama 'nombre'
      .eq("id", grupo_id)
      .single();

    if (errGrupo || !grupo) {
      console.error("Error al obtener el grupo:", errGrupo);
      mostrarMensaje("error", "❌ Error al obtener el grupo");
      return;
    }

    // Obtener asesores del grupo por nombre
    const {  asesores, error: errAsesores } = await supabase
      .from("usuarios")
      .select("id")
      .eq("rol", "usuario")
      .eq("grupo_nombre", grupo.nombre)  // ← Ahora sí coincide
      .eq("estado", "Activo");

    if (errAsesores) {
      console.error("Error al obtener asesores:", errAsesores);
      mostrarMensaje("error", "❌ Error al obtener asesores del grupo");
      return;
    }

if (asesores && asesores.length > 0) {
  console.log("Asignando curso a", asesores.length, "asesores:", asesores);
  const { error: errorInsert } = await supabase.from("cursos_asesores").insert(
    asesores.map((u) => ({
      curso_activado_id: activacion.id,
      asesor_id: u.id,
    }))
  );

  if (errorInsert) {
    console.error("Error al asignar asesores:", errorInsert);
    mostrarMensaje("error", "⚠️ Curso activado pero error al asignar asesores");
  } else {
    mostrarMensaje("success", `✅ Curso activado y asignado a ${asesores.length} asesores`);
  }
} else {
  console.log("No hay asesores activos en el grupo para asignar.");
  mostrarMensaje("success", "✅ Curso activado (sin asesores en el grupo)");
}

await cargarActivos(); // Refrescar lista
await cargarGrupos(seleccion.campana_id); // Refrescar grupos
setSeleccion({ ...seleccion, curso_id: "" });

  } catch (err) {
    console.error("Error *interno* en activarCurso:", err);
    mostrarMensaje("error", "❌ Error inesperado al activar");
  } finally {
    setLoading(false);
    console.log("Finalizado proceso de activación (loading = false).");
  }
};

  const desactivarCurso = async (id) => {
    console.log("Intentando desactivar curso con id:", id); // Log 43
    if (!confirm("¿Seguro que deseas desactivar este curso? Se eliminarán todas las asignaciones a asesores.")) {
      return;
    }

    setLoading(true);

    try {
      const { error: errorAsesores } = await supabase
        .from("cursos_asesores")
        .delete()
        .eq("curso_activado_id", id);

      if (errorAsesores) {
        console.error("Error eliminando asignaciones a asesores:", errorAsesores); // Log 44
        mostrarMensaje("error", "❌ Error al eliminar asignaciones");
        return;
      }

      const { error } = await supabase
        .from("cursos_activados")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error eliminando curso activado:", error); // Log 45
        mostrarMensaje("error", "❌ Error al desactivar el curso");
        return;
      }

      mostrarMensaje("success", "🗑️ Curso desactivado correctamente");
      await cargarActivos(); // Refrescar lista

    } catch (err) {
      console.error("Error *interno* en desactivarCurso:", err); // Log 46
      mostrarMensaje("error", "❌ Error inesperado al desactivar");
    } finally {
      setLoading(false);
      console.log("Finalizado proceso de desactivación (loading = false)."); // Log 47
    }
  };

  const handleCampanaChange = async (campana_id) => {
    console.log("Cambiando campaña a:", campana_id); // Log 48
    setSeleccion({ campana_id, grupo_id: "", curso_id: "" });
    setGrupos([]);
    setCursos([]);
    if (campana_id) {
      await cargarGrupos(campana_id);
    }
  };

  const handleGrupoChange = async (grupo_id) => {
    console.log("Cambiando grupo a:", grupo_id); // Log 49
    setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
    setCursos([]);
    if (grupo_id) {
      await cargarCursos(seleccion.campana_id, grupo_id);
    }
  };

  // --- CORRECCIONES DE RENDERIZADO APLICADAS ---
  console.log("Estado actual - Campañas:", campañas.length, "Grupos:", grupos.length, "Cursos:", cursos.length, "Activos:", activos.length); // Log Final UI

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header con botón de logout */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel del Formador</h1>
            <p className="text-gray-600">📅 {fechaHoyFormateada}</p>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>

        {/* Mensaje de feedback */}
        {mensaje.texto && (
          <div className={`mb-6 p-4 rounded-lg shadow-sm animate-in slide-in-from-top ${
            mensaje.tipo === "success" ? "bg-green-50 border border-green-200 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border border-red-200 text-red-800" :
            "bg-blue-50 border border-blue-200 text-blue-800"
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Panel de activación */}
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-xl text-gray-900">🎯 Activar Curso</h2>
              {loading && (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>

            {/* Selección de campaña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaña
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                value={seleccion.campana_id}
                onChange={(e) => handleCampanaChange(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecciona una campaña</option>
                {campañas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Selección de grupo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grupo
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:bg-gray-100"
                value={seleccion.grupo_id}
                onChange={(e) => handleGrupoChange(e.target.value)}
                disabled={!seleccion.campana_id || loading}
              >
                <option value="">Selecciona un grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre} ({g.activos || 0} asesores activos)
                  </option>
                ))}
              </select>
            </div>

            {/* Vista previa de malla */}
            {cursos.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  📚 Malla de cursos disponibles
                  <span className="text-sm font-normal text-gray-600">({cursos.length} cursos)</span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cursos.map((c, index) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-800">{c.titulo}</span>
                      </div>
                      <span className="text-sm text-gray-500">{c.duracion_minutos} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selección de curso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Curso a activar hoy
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:bg-gray-100"
                value={seleccion.curso_id}
                onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
                disabled={!cursos.length || loading}
              >
                <option value="">Selecciona el curso a activar</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo} - {c.duracion_minutos} min
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={activarCurso}
              disabled={!seleccion.curso_id || loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-md hover:shadow-lg"
            >
              {loading ? "Activando..." : "✨ Activar curso de hoy"}
            </button>
          </div>

          {/* Panel de cursos activos */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="font-semibold text-xl text-gray-900 mb-4">
              🎓 Cursos activos hoy
            </h2>

            {activos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-500">No hay cursos activados todavía</p>
                <p className="text-sm text-gray-400 mt-2">Activa un curso para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activos.map((a) => (
                  <div
                    key={a.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        {/* CORRECCIÓN: Uso de encadenamiento opcional y valores por defecto */}
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {a.cursos?.titulo || "Curso sin título"}
                        </h3>
                        <div className="flex flex-col gap-1 text-sm text-gray-600">
                          <span>👥 {a.grupos?.nombre || "Sin grupo"}</span>
                          <span>📊 {a.campañas?.nombre || "Sin campaña"}</span>
                          <span className="text-indigo-600 font-medium">
                            ✓ {a.asesores_count || 0} asesores asignados
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => desactivarCurso(a.id)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                        title="Desactivar curso"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
