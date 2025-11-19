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
    } catch (err) {
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
      setCampañas([]);
      mostrarMensaje("error", "Error al cargar campañas");
    }
  };

  const cargarGrupos = async (campana_id) => {
    if (!campana_id) return;
    setLoading(true);

    try {
      const { data: gruposData, error: gruposError } = await supabase
        .from("grupos")
        .select("*")
        .eq("campana_id", campana_id);

      if (gruposError) {
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
          return { ...g, activos: count || 0 };
        })
      );

      setGrupos(gruposConConteo);

    } catch {
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

      if (grupo_id) query = query.or(`grupo_id.is.null,grupo_id.eq.${grupo_id}`);

      const { data, error } = await query;
      if (!error) setCursos(data || []);
      else {
        setCursos([]);
        mostrarMensaje("error", "Error al cargar cursos");
      }
    } catch {
      setCursos([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarActivos = async () => {
    if (!user?.id) {
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

    if (error || !data) {
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
    } catch {
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
      const { data: existe } = await supabase
        .from("cursos_activados")
        .select("*")
        .eq("fecha", fechaHoy)
        .eq("campana_id", campana_id)
        .eq("grupo_id", grupo_id)
        .eq("curso_id", curso_id)
        .maybeSingle();

      if (existe) {
        mostrarMensaje("error", "⚠️ Este curso ya está activado hoy");
        return;
      }

      const { data: activacion, error } = await supabase
        .from("cursos_activados")
        .insert([{ campana_id, grupo_id, curso_id, fecha: fechaHoy, activo: true, formador_id: user.id }])
        .select()
        .single();

      if (error) {
        mostrarMensaje("error", "❌ Error al activar el curso");
        return;
      }

      const { data: grupo } = await supabase
        .from("grupos")
        .select("nombre")
        .eq("id", grupo_id)
        .single();

      const { data: asesores } = await supabase
        .from("usuarios")
        .select("id")
        .eq("rol", "usuario")
        .eq("grupo_nombre", grupo.nombre)
        .eq("estado", "Activo");

      if (asesores && asesores.length > 0) {
        await supabase.from("cursos_asesores").insert(
          asesores.map((u) => ({ curso_activado_id: activacion.id, asesor_id: u.id }))
        );
        mostrarMensaje("success", `✅ Curso activado y asignado a ${asesores.length} asesores`);
      } else {
        mostrarMensaje("success", "✅ Curso activado (sin asesores en el grupo)");
      }

      await cargarActivos();
      await cargarGrupos(seleccion.campana_id);
      setSeleccion({ ...seleccion, curso_id: "" });

    } catch {
      mostrarMensaje("error", "❌ Error inesperado al activar");
    } finally {
      setLoading(false);
    }
  };

  const desactivarCurso = async (id) => {
    if (!confirm("¿Seguro que deseas desactivar este curso?")) return;
    setLoading(true);

    try {
      await supabase.from("cursos_asesores").delete().eq("curso_activado_id", id);
      await supabase.from("cursos_activados").delete().eq("id", id);
      mostrarMensaje("success", "🗑️ Curso desactivado correctamente");
      await cargarActivos();
    } catch {
      mostrarMensaje("error", "❌ Error inesperado al desactivar");
    } finally {
      setLoading(false);
    }
  };

  const handleCampanaChange = async (campana_id) => {
    setSeleccion({ campana_id, grupo_id: "", curso_id: "" });
    setGrupos([]);
    setCursos([]);
    if (campana_id) await cargarGrupos(campana_id);
  };

  const handleGrupoChange = async (grupo_id) => {
    setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
    setCursos([]);
    if (grupo_id) await cargarCursos(seleccion.campana_id, grupo_id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel del Formador</h1>
            <p className="text-gray-600">📅 {fechaHoyFormateada}</p>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Mensaje */}
        {mensaje.texto && (
          <div className={`mb-6 p-4 rounded-lg shadow-sm ${
            mensaje.tipo === "success" ? "bg-green-50 border border-green-200 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border border-red-200 text-red-800" :
            "bg-blue-50 border border-blue-200 text-blue-800"
          }`}>
            {mensaje.texto}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Activación */}
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-xl text-gray-900">🎯 Activar Curso</h2>
              {loading && <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
            </div>

            {/* Selección campaña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Campaña</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition"
                value={seleccion.campana_id}
                onChange={(e) => handleCampanaChange(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecciona una campaña</option>
                {campañas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Selección grupo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grupo</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition disabled:bg-gray-100"
                value={seleccion.grupo_id}
                onChange={(e) => handleGrupoChange(e.target.value)}
                disabled={!seleccion.campana_id || loading}
              >
                <option value="">Selecciona un grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre} ({g.activos || 0} asesores)</option>)}
              </select>
            </div>

            {/* Cursos disponibles */}
            {cursos.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">📚 Malla de cursos ({cursos.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {cursos.map((c, index) => (
                    <div key={c.id} className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm hover:shadow-md transition">
                      <span className="font-medium text-gray-800">{c.titulo}</span>
                      <span className="text-xs text-gray-500">{c.duracion_minutos} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selección curso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Curso a activar hoy</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 transition disabled:bg-gray-100"
                value={seleccion.curso_id}
                onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
                disabled={!cursos.length || loading}
              >
                <option value="">Selecciona el curso</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.titulo} - {c.duracion_minutos} min</option>)}
              </select>
            </div>

            <button
              onClick={activarCurso}
              disabled={!seleccion.curso_id || loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition font-medium shadow-md"
            >
              {loading ? "Activando..." : "✨ Activar curso de hoy"}
            </button>
          </div>

          {/* Cursos activos */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="font-semibold text-xl text-gray-900 mb-4">🎓 Cursos activos hoy</h2>
            {activos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-500">No hay cursos activados todavía</p>
                <p className="text-sm text-gray-400 mt-2">Activa un curso para comenzar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activos.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl shadow-md p-4 hover:shadow-lg flex flex-col justify-between">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900 mb-1">{a.cursos?.titulo || "Curso sin título"}</h3>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Grupo: {a.grupos?.nombre || "Sin grupo"}</span>
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Campaña: {a.campañas?.nombre || "Sin campaña"}</span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">Asesores: {a.asesores_count || 0}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => desactivarCurso(a.id)}
                      disabled={loading}
                      className="self-end text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
