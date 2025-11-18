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

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      await Promise.all([cargarCampañas(), cargarActivos()]);
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
    if (!error) setCampañas(data || []);
    else {
      setCampañas([]);
      mostrarMensaje("error", "Error al cargar campañas");
    }
  };

  const cargarGrupos = async (campana_id) => {
    if (!campana_id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("grupos")
        .select(`
          *,
          usuarios:usuarios_grupo_id_fkey(
            id,
            estado,
            rol
          )
        `)
        .eq("campana_id", campana_id);

      if (error) {
        console.error("Error:", error);
        setGrupos([]);
        return;
      }

      const gruposConConteo = data.map(g => ({
        ...g,
        activos: g.usuarios?.filter(
          u => u.estado === "Activo" && u.rol === "Usuario"
        ).length || 0
      }));

      setGrupos(gruposConConteo);

    } catch (err) {
      console.error("Error cargando grupos:", err);
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
      if (!error) setCursos(data || []);
      else {
        setCursos([]);
        mostrarMensaje("error", "Error al cargar cursos");
      }
    } catch (err) {
      console.error("Error cargando cursos:", err);
      setCursos([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarActivos = async () => {
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

    if (!error && data) {
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
    } else {
      setActivos([]);
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
      const { data: existe } = await supabase
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
        mostrarMensaje("error", "❌ Error al activar el curso");
        return;
      }

      const { data: asesores, error: errAsesores } = await supabase
        .from("usuarios")
        .select("id")
        .eq("rol", "Usuario")
        .eq("grupo_id", grupo_id)
        .eq("estado", "Activo");

      if (!errAsesores && asesores.length > 0) {
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
      setSeleccion({ ...seleccion, curso_id: "" });

    } catch (err) {
      console.error("Error al activar curso:", err);
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
        console.error("Error eliminando asignaciones a asesores:", errorAsesores);
        mostrarMensaje("error", "❌ Error al eliminar asignaciones");
        return;
      }

      const { error } = await supabase
        .from("cursos_activados")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error eliminando curso activado:", error);
        mostrarMensaje("error", "❌ Error al desactivar el curso");
        return;
      }

      mostrarMensaje("success", "🗑️ Curso desactivado correctamente");
      await cargarActivos();

    } catch (err) {
      console.error("Error inesperado al desactivar curso:", err);
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

  // --- CORRECCIÓN AQUÍ: Verificación de objetos antes de acceder a propiedades ---
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
                        {/* CORRECCIÓN: Verificación antes de acceder a propiedades anidadas */}
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {a.cursos?.titulo || "Curso sin título"}
                        </h3>
                        <div className="flex flex-col gap-1 text-sm text-gray-600">
                          {/* CORRECCIÓN: Verificación antes de acceder a propiedades anidadas */}
                          <span>👥 {a.grupos?.nombre || "Sin grupo"}</span>
                          {/* CORRECCIÓN: Verificación antes de acceder a propiedades anidadas */}
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
