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
  const [gruposConCursos, setGruposConCursos] = useState([]);
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

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

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
    if (!campana_id) {
      return;
    }
    setLoading(true);

    try {
      const {  gruposData, error: gruposError } = await supabase
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
            activos: count || 0,
            id: Number(g.id),
            nombre: String(g.nombre || "").trim(),
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
    if (!campana_id || !grupo_id) {
        return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from("cursos")
        .select("*")
        .eq("campana_id", campana_id)
        .eq("estado", "Activo");

      if (grupo_id) {
        const grupoIdNum = Number(grupo_id);
        if (!isNaN(grupoIdNum)) {
          query = query.or(`grupo_id.is.null,grupo_id.eq.${grupoIdNum}`);
        } else {
          query = query.or(`grupo_id.is.null,grupo_id.eq.${grupo_id}`);
        }
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
        setGruposConCursos([]);
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
        setGruposConCursos([]);
        return;
    }

    if (!data) {
        setActivos([]);
        setGruposConCursos([]);
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

      // Agrupar cursos por grupo
      const gruposMap = {};
      activosConConteo.forEach((a) => {
        const grupoId = a.grupo_id;
        if (!gruposMap[grupoId]) {
          gruposMap[grupoId] = {
            grupo: a.grupos || { nombre: "Sin grupo", activos: 0 },
            cursos: [],
          };
        }
        gruposMap[grupoId].cursos.push(a);
      });

      setGruposConCursos(Object.values(gruposMap));
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

    const grupoIdNumerico = Number(grupo_id);
    if (isNaN(grupoIdNumerico) || grupoIdNumerico <= 0) {
      mostrarMensaje("error", "⚠️ Grupo inválido");
      return;
    }

    setLoading(true);

    try {
      const {  existe } = await supabase
        .from("cursos_activados")
        .select("*")
        .eq("fecha", fechaHoy)
        .eq("campana_id", campana_id)
        .eq("grupo_id", grupoIdNumerico)
        .eq("curso_id", curso_id)
        .maybeSingle();

      if (existe) {
        mostrarMensaje("error", "⚠️ Este curso ya está activado hoy para esa campaña y grupo");
        return;
      }

      const {  activacion, error } = await supabase
        .from("cursos_activados")
        .insert([
          {
            campana_id,
            grupo_id: grupoIdNumerico,
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

      const {  grupo, error: errGrupo } = await supabase
        .from("grupos")
        .select("nombre")
        .eq("id", grupoIdNumerico)
        .single();

      if (errGrupo || !grupo) {
        console.error("Error al obtener el grupo:", errGrupo, "ID:", grupoIdNumerico);
        mostrarMensaje("error", "❌ Error al obtener el grupo");
        return;
      }

      const {  asesores, error: errAsesores } = await supabase
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Fondo dinámico con partículas sutiles (CSS-only) */}
      <style jsx>{`
        .bg-particles::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle at 20% 50%, rgba(147, 51, 234, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
          z-index: -1;
          animation: pulse 8s infinite alternate;
        }
        @keyframes pulse {
          0% { opacity: 0.2; }
          100% { opacity: 0.4; }
        }
      `}</style>

      {/* Header con botón de logout */}
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Panel del Formador</h1>
              <p className="text-gray-300">📅 {fechaHoyFormateada}</p>
            </div>
            <button
              onClick={onLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-red-500/20 transition-all flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mensaje de feedback */}
      {mensaje.texto && (
        <div className="max-w-[95vw] mx-auto px-4 md:px-8 pt-4">
          <div className={`p-4 rounded-lg shadow-sm border-l-4 animate-in slide-in-from-top duration-500 ${
            mensaje.tipo === "success" ? "bg-green-500/20 border-l-green-400 text-green-200" :
            mensaje.tipo === "error" ? "bg-red-500/20 border-l-red-400 text-red-200" :
            "bg-blue-500/20 border-l-blue-400 text-blue-200"
          }`}>
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        </div>
      )}

      <div className="max-w-[95vw] mx-auto px-4 md:px-8 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Panel de activación (izquierda) - sin cambios */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-xl text-white flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 p-2 rounded-lg border border-indigo-500/30">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
                Activar Curso
              </h2>
              {loading && (
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>

            {/* Selección de campaña */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Campaña
              </label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white placeholder-gray-400"
                value={seleccion.campana_id}
                onChange={(e) => handleCampanaChange(e.target.value)}
                disabled={loading}
              >
                <option value="" className="bg-slate-800">Selecciona una campaña</option>
                {campañas.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-800">
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Selección de grupo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Grupo
              </label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white placeholder-gray-400 disabled:bg-gray-700"
                value={seleccion.grupo_id}
                onChange={(e) => handleGrupoChange(e.target.value)}
                disabled={!seleccion.campana_id || loading}
              >
                <option value="" className="bg-slate-800">Selecciona un grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-800">
                    {g.nombre} ({g.activos || 0} asesores activos)
                  </option>
                ))}
              </select>
            </div>

            {/* Vista previa de malla */}
            {cursos.length > 0 && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-300 p-1 rounded border border-indigo-500/30">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.036-.687-.101-1.016A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                  </span>
                  Malla de cursos
                  <span className="text-sm font-normal text-gray-400">({cursos.length} cursos)</span>
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cursos.map((c, index) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white/10 p-2 rounded-md shadow-sm text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 bg-indigo-500/20 text-indigo-300 rounded-full text-[0.6rem] font-bold border border-indigo-500/30">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-200 truncate max-w-[120px] md:max-w-[180px]">{c.titulo}</span>
                      </div>
                      <span className="text-xs text-gray-400">{c.duracion_minutos} min</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selección de curso */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Curso a activar
              </label>
              <select
                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition text-sm text-white placeholder-gray-400 disabled:bg-gray-700"
                value={seleccion.curso_id}
                onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
                disabled={!cursos.length || loading}
              >
                <option value="" className="bg-slate-800">Selecciona el curso a activar</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-800">
                    {c.titulo} - {c.duracion_minutos} min
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={activarCurso}
              disabled={!seleccion.curso_id || loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-indigo-500/20 transition-all font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? "Activando..." : "✨ Activar curso de hoy"}
            </button>
          </div>

          {/* Panel de grupos asignados (derecha) - AGRUPADOS POR GRUPO */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl shadow-purple-500/5 p-6">
            <h2 className="font-semibold text-xl text-white mb-4 flex items-center gap-2">
              <span className="bg-green-500/20 text-green-300 p-2 rounded-lg border border-green-500/30">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
              Grupos asignados hoy
            </h2>

            {gruposConCursos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 text-gray-500">📂</div>
                <p className="text-gray-400 text-sm mb-1">No hay grupos con cursos activos</p>
                <p className="text-xs text-gray-500">Activa un curso para asignarlo a un grupo</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                {gruposConCursos.map((grupoData) => {
                  const grupo = grupoData.grupo || { nombre: "Sin grupo", activos: 0 };
                  const cursosDelGrupo = grupoData.cursos;

                  return (
                    <div
                      key={grupo.id || "sin_grupo"}
                      className="border border-white/20 rounded-xl bg-white/5 p-4"
                    >
                      {/* Encabezado del grupo */}
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-500/20 text-indigo-300 p-1.5 rounded-full text-xs font-bold border border-indigo-500/30">
                            {cursosDelGrupo.length}
                          </span>
                          <h3 className="font-semibold text-gray-100 text-lg">
                            {grupo.nombre}
                          </h3>
                          <span className="text-xs text-gray-400 bg-white/10 px-2 py-1 rounded-full">
                            ({grupo.activos || 0} asesores activos)
                          </span>
                        </div>
                      </div>

                      {/* Lista de cursos dentro del grupo */}
                      <div className="space-y-3">
                        {cursosDelGrupo.map((a) => (
                          <div
                            key={a.id}
                            className="border border-white/20 rounded-lg p-3 hover:shadow-md transition-all bg-white/10 flex justify-between items-start"
                          >
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-100 mb-1">
                                {a.cursos?.titulo || "Curso sin título"}
                              </h3>
                              <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 005 10a6 6 0 0012 0c0-.35-.036-.687-.101-1.016A5 5 0 0010 11z" clipRule="evenodd" />
                                  </svg>
                                  <span className="truncate">{a.cursos?.duracion_minutos || 0} min</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                                  </svg>
                                  <span className="truncate">{a.campañas?.nombre || "Sin campaña"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="font-medium text-green-400">
                                    {a.asesores_count || 0} asesores asignados
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => desactivarCurso(a.id)}
                              disabled={loading}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
                              title="Desactivar curso"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
