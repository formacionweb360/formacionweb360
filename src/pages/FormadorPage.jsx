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

  // Estado para controlar acordeones
  const [expandedGroups, setExpandedGroups] = useState({});
  const [allExpanded, setAllExpanded] = useState(false);

  const fechaHoy = new Date().toISOString().split("T")[0];
  const fechaHoyFormateada = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      await Promise.all([cargarCampañas(), cargarActivos()]);
    } catch (err) {
      console.error("Error en la carga general de datos:", err);
      mostrarMensaje("error", "Error al cargar datos iniciales.");
    } finally {
      setLoading(false);
    }
  };

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*");
    if (!error) {
      setCampañas(data || []);
    } else {
      console.error("Error al cargar campañas:", error);
      setCampañas([]);
      mostrarMensaje("error", "Error al cargar campañas");
    }
  };

  const cargarGrupos = async (campana_id) => {
    if (!campana_id) return;
    setLoading(true);
    try {
      const { gruposData, error: gruposError } = await supabase
        .from("grupos")
        .select("*")
        .eq("campana_id", campana_id);

      if (gruposError) {
        console.error("Error cargando grupos:", gruposError);
        setGrupos([]);
        return;
      }

      const gruposConConteo = await Promise.all(
        gruposData.map(async (g) => {
          const { count } = await supabase
            .from("usuarios")
            .select("*", { count: "exact", head: true })
            .eq("grupo_nombre", g.nombre)
            .eq("rol", "usuario")
            .eq("estado", "Activo");

          return {
            ...g,
            activos: count || 0
          };
        })
      );

      setGrupos(gruposConConteo);
    } catch (err) {
      console.error("Error *interno* en cargarGrupos:", err);
      setGrupos([]);
    } finally {
      setLoading(false);
    }
  };
  
  const cargarCursos = async (campana_id, grupo_id) => {
    if (!campana_id || !grupo_id) return;
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
      } else {
        console.error("Error al cargar cursos:", error);
        setCursos([]);
        mostrarMensaje("error", "Error al cargar cursos");
      }
    } catch (err) {
      console.error("Error *interno* en cargarCursos:", err);
      setCursos([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarActivos = async () => {
    if (!user?.id) {
        console.error("User no está definido o no tiene ID. No se pueden cargar activos.");
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
        console.error("Error al cargar cursos activos:", error);
        setActivos([]);
        return;
    }

    if (!data) {
        setActivos([]);
        return;
    }

    try {
      const activosConConteo = await Promise.all(
        data.map(async (activado) => {
          const { count } = await supabase
            .from("cursos_asesores")
            .select("*", { count: "exact", head: true })
            .eq("curso_activado_id", activado.id);

          return { ...activado, asesores_count: count || 0 };
        })
      );
      setActivos(activosConConteo);
    } catch (err) {
        console.error("Error contando asesores:", err);
        setActivos(data.map(a => ({...a, asesores_count: 0})));
    }
  };

 const activarCurso = async () => {
  const { campana_id, grupo_id, curso_id } = seleccion;
  if (!campana_id || !grupo_id || !curso_id) {
    mostrarMensaje("error", "⚠️ Debes seleccionar campaña, grupo y curso");
    return;
  }

  setLoading(true);
  try {
    const { existe } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("fecha", fechaHoy)
      .eq("campana_id", campana_id)
      .eq("grupo_id", grupo_id)
      .eq("curso_id", curso_id)
      .maybeSingle();

    if (existe) {
      mostrarMensaje("error", "⚠️ Este curso ya está activado hoy para esa campaña y grupo");
      return;
    }

    const { data: activacion, error } = await supabase
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

    const { data: grupo, error: errGrupo } = await supabase
      .from("grupos")
      .select("nombre")
      .eq("id", grupo_id)
      .single();

    if (errGrupo || !grupo) {
      console.error("Error al obtener el grupo:", errGrupo);
      mostrarMensaje("error", "❌ Error al obtener el grupo");
      return;
    }

    const { data: asesores, error: errAsesores } = await supabase
      .from("usuarios")
      .select("id")
      .eq("rol", "usuario")
      .eq("grupo_nombre", grupo.nombre)
      .eq("estado", "Activo");

    if (errAsesores) {
      console.error("Error al obtener asesores:", errAsesores);
      mostrarMensaje("error", "❌ Error al obtener asesores del grupo");
      return;
    }

    if (asesores && asesores.length > 0) {
      const { error: errorInsert } = await supabase.from("cursos_asesores").insert(
        asesores.map((u) => ({
          curso_activado_id: activacion.id,
          asesor_id: u.id,
        }))
      );

      if (errorInsert) {
        mostrarMensaje("error", "⚠️ Curso activado pero error al asignar asesores");
      } else {
        mostrarMensaje("success", `✅ Curso activado y asignado a ${asesores.length} asesores`);
      }
    } else {
      mostrarMensaje("success", "✅ Curso activado (sin asesores en el grupo)");
    }

    await cargarActivos();
    await cargarGrupos(seleccion.campana_id);
    setSeleccion({ ...seleccion, curso_id: "" });

  } catch (err) {
    console.error("Error *interno* en activarCurso:", err);
    mostrarMensaje("error", "❌ Error inesperado al activar");
  } finally {
    setLoading(false);
  }
};

  const desactivarCurso = async (id) => {
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
        mostrarMensaje("error", "❌ Error al eliminar asignaciones");
        return;
      }

      const { error } = await supabase
        .from("cursos_activados")
        .delete()
        .eq("id", id);

      if (error) {
        mostrarMensaje("error", "❌ Error al desactivar el curso");
        return;
      }

      mostrarMensaje("success", "🗑️ Curso desactivado correctamente");
      await cargarActivos();

    } catch (err) {
      mostrarMensaje("error", "❌ Error inesperado al desactivar");
    } finally {
      setLoading(false);
    }
  };

  const handleCampanaChange = async (campana_id) => {
    setSeleccion({ campana_id, grupo_id: "", curso_id: "" });
    setGrupos([]);
    setCursos([]);
    if (campana_id) {
      await cargarGrupos(campana_id);
    }
  };

  const handleGrupoChange = async (grupo_id) => {
    setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
    setCursos([]);
    if (grupo_id) {
      await cargarCursos(seleccion.campana_id, grupo_id);
    }
  };

  // Agrupar activos por grupo
  const activosAgrupados = {};
  activos.forEach(item => {
    const grupoNombre = item.grupos?.nombre || 'Sin grupo';
    if (!activosAgrupados[grupoNombre]) {
      activosAgrupados[grupoNombre] = {
        nombre: grupoNombre,
        cursos: [],
        totalAsesores: 0
      };
    }
    activosAgrupados[grupoNombre].cursos.push(item);
    activosAgrupados[grupoNombre].totalAsesores += item.asesores_count || 0;
  });

  // Funciones para manejar acordeones
  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleAll = () => {
    const newState = !allExpanded;
    setAllExpanded(newState);
    const newExpanded = {};
    Object.keys(activosAgrupados).forEach(groupName => {
      newExpanded[groupName] = newState;
    });
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-3 md:p-4">
      {/* Contenedor principal */}
      <div className="w-full max-w-full mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Panel del Formador</h1>
            <p className="text-gray-600 text-xs md:text-sm">📅 {fechaHoyFormateada}</p>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs md:text-sm shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Cerrar sesión</span>
            <span className="sm:hidden">Salir</span>
          </button>
        </div>

        {/* Mensaje de feedback */}
        {mensaje.texto && (
          <div className={`mb-3 p-2 rounded-lg shadow-sm ${
            mensaje.tipo === "success" ? "bg-green-50 border border-green-200 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border border-red-200 text-red-800" :
            "bg-blue-50 border border-blue-200 text-blue-800"
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          {/* Panel de activación */}
          <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 space-y-2 md:space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-1.5">
                <span className="bg-indigo-100 text-indigo-700 p-1 rounded">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </span>
                Activar Curso
              </h2>
              {loading && (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>

            {/* Selección de campaña */}
            <div>
              <label className="block text-[11px] md:text-xs font-medium text-gray-700 mb-0.5">
                Campaña
              </label>
              <select
                className="w-full border border-gray-300 rounded-md p-1.5 md:p-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-xs"
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
              <label className="block text-[11px] md:text-xs font-medium text-gray-700 mb-0.5">
                Grupo
              </label>
              <select
                className="w-full border border-gray-300 rounded-md p-1.5 md:p-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-xs disabled:bg-gray-100"
                value={seleccion.grupo_id}
                onChange={(e) => handleGrupoChange(e.target.value)}
                disabled={!seleccion.campana_id || loading}
              >
                <option value="">Selecciona un grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre} ({g.activos || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Vista previa de malla */}
            {cursos.length > 0 && (
              <div className="bg-indigo-50 p-2 rounded-md border border-indigo-200">
                <h3 className="font-semibold text-xs md:text-sm text-gray-900 mb-1 flex items-center gap-1.5">
                  <span className="bg-indigo-100 text-indigo-700 p-0.5 rounded">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                  </span>
                  Malla de cursos ({cursos.length})
                </h3>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {cursos.map((c, index) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white p-1 rounded text-[11px] md:text-xs"
                    >
                      <div className="flex items-center gap-1">
                        <span className="flex items-center justify-center w-4 h-4 bg-indigo-100 text-indigo-700 rounded-full text-[0.6rem] font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-800 truncate max-w-[100px] md:max-w-[150px]">{c.titulo}</span>
                      </div>
                      <span className="text-[10px] text-gray-500">{c.duracion_minutos}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selección de curso */}
            <div>
              <label className="block text-[11px] md:text-xs font-medium text-gray-700 mb-0.5">
                Curso a activar
              </label>
              <select
                className="w-full border border-gray-300 rounded-md p-1.5 md:p-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-xs disabled:bg-gray-100"
                value={seleccion.curso_id}
                onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
                disabled={!cursos.length || loading}
              >
                <option value="">Selecciona el curso</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo} - {c.duracion_minutos}m
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={activarCurso}
              disabled={!seleccion.curso_id || loading}
              className="w-full bg-indigo-600 text-white py-1.5 px-3 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-sm hover:shadow-md text-xs"
            >
              {loading ? "Activando..." : "✨ Activar"}
            </button>
          </div>

          {/* Panel de cursos activos - AGRUPADOS Y CON ACORDEÓN */}
          <div className="bg-white rounded-lg shadow-sm p-3 md:p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-1.5">
                <span className="bg-green-100 text-green-700 p-1 rounded">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
                Cursos activos hoy
              </h2>
              <button
                onClick={toggleAll}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md transition"
              >
                {allExpanded ? "Contraer todo" : "Expandir todo"}
              </button>
            </div>

            {activos.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-gray-500 text-xs">No hay cursos activados</p>
                <p className="text-[10px] text-gray-400 mt-1">Activa un curso para comenzar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Mapeamos los grupos agrupados */}
                {Object.entries(activosAgrupados).map(([grupoNombre, grupoData], grupoIndex) => (
                  <div key={grupoNombre} className="border border-gray-200 rounded-md overflow-hidden">
                    {/* Encabezado del grupo - Acordión */}
                    <div 
                      className={`p-2.5 flex items-center justify-between cursor-pointer ${
                        expandedGroups[grupoNombre] ? 'bg-indigo-50' : 'bg-gray-50'
                      }`}
                      onClick={() => toggleGroup(grupoNombre)}
                    >
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 transition-transform ${expandedGroups[grupoNombre] ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <h3 className="font-medium text-gray-800 text-xs md:text-sm">
                          {grupoNombre}
                        </h3>
                      </div>
                      <span className="text-[10px] md:text-xs font-medium bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        {grupoData.totalAsesores} asesores
                      </span>
                    </div>
                    
                    {/* Contenido del acordeón */}
                    {expandedGroups[grupoNombre] && (
                      <div className="divide-y divide-gray-100">
                        {grupoData.cursos.map((a) => (
                          <div key={a.id} className="p-2.5 flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-xs truncate">
                                {a.cursos?.titulo || "Curso sin título"}
                              </h4>
                              <div className="flex flex-col gap-0.5 mt-0.5 text-[10px] md:text-xs text-gray-600">
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                                  </svg>
                                  <span className="truncate">{a.campañas?.nombre || "Sin campaña"}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="font-medium text-green-600">
                                    {a.asesores_count || 0} asesores asignados
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Evita que se cierre el acordeón al hacer clic en el botón
                                desactivarCurso(a.id);
                              }}
                              disabled={loading}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-50 flex-shrink-0 ml-1"
                              title="Desactivar curso"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
