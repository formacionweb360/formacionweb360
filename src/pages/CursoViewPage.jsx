import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

export default function CursoViewPage({ user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [curso, setCurso] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [tiempoVisto, setTiempoVisto] = useState(0);
  const [iniciado, setIniciado] = useState(false);

  useEffect(() => {
    let interval;
    if (iniciado && progreso?.estado !== "Completado") {
      interval = setInterval(() => {
        setTiempoVisto((prev) => prev + 1);
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [iniciado, progreso]);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  useEffect(() => {
    if (curso && !iniciado) {
      setIniciado(true);
    }
  }, [curso]);

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { data: cursoData, error: errorCurso } = await supabase
        .from("cursos_activados")
        .select(`
          id,
          curso_id,
          fecha,
          grupo_id,
          campana_id,
          cursos(id, titulo, descripcion, url_iframe, duracion_minutos),
          grupos(nombre),
          campañas(nombre)
        `)
        .eq("id", id)
        .single();

      if (errorCurso) {
        mostrarMensaje("error", "❌ Error al cargar el curso");
        console.error(errorCurso);
        return;
      }

      setCurso(cursoData);

      const { data: progresoData, error: errorProgreso } = await supabase
        .from("progreso_usuarios")
        .select("*")
        .eq("usuario", user.usuario)
        .eq("curso_id", cursoData.curso_id)
        .maybeSingle();

      if (!errorProgreso && progresoData) {
        setProgreso(progresoData);
        setTiempoVisto(progresoData.progreso || 0);
      } else {
        const { data: nuevoProgreso, error: errorNuevo } = await supabase
          .from("progreso_usuarios")
          .insert([
            {
              usuario: user.usuario,
              curso_id: cursoData.curso_id,
              fecha_inicio: new Date().toISOString(),
              progreso: 0,
              estado: "En curso",
            },
          ])
          .select()
          .single();

        if (!errorNuevo) {
          setProgreso(nuevoProgreso);
        }
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
      mostrarMensaje("error", "❌ Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const actualizarProgreso = async () => {
    if (!progreso) return;

    try {
      await supabase
        .from("progreso_usuarios")
        .update({ progreso: tiempoVisto })
        .eq("id", progreso.id);
    } catch (err) {
      console.error("Error actualizando progreso:", err);
    }
  };

  useEffect(() => {
    if (progreso && tiempoVisto > 0 && tiempoVisto % 2 === 0) {
      actualizarProgreso();
    }
  }, [tiempoVisto]);

  const marcarCompletado = async () => {
    if (!progreso || !curso) return;

    const confirmar = window.confirm(
      "¿Estás seguro de marcar este curso como completado?"
    );

    if (!confirmar) return;

    setGuardando(true);
    try {
      const { error: errorProgreso } = await supabase
        .from("progreso_usuarios")
        .update({
          estado: "Completado",
          fecha_fin: new Date().toISOString(),
          progreso: Math.max(tiempoVisto, curso.cursos.duracion_minutos),
        })
        .eq("id", progreso.id);

      if (errorProgreso) {
        mostrarMensaje("error", "❌ Error al completar el curso");
        return;
      }

      mostrarMensaje("success", "🎉 ¡Curso completado exitosamente!");
      
      await cargarDatos();

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Error marcando completado:", err);
      mostrarMensaje("error", "❌ Error inesperado");
    } finally {
      setGuardando(false);
    }
  };

  const formatearTiempo = (minutos) => {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    }
    return `${mins} min`;
  };

  const calcularPorcentaje = () => {
    if (!curso) return 0;
    const duracion = curso.cursos.duracion_minutos || 30;
    const porcentaje = Math.min((tiempoVisto / duracion) * 100, 100);
    return Math.round(porcentaje);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando curso...</p>
        </div>
      </div>
    );
  }

  if (!curso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Curso no encontrado</h2>
          <p className="text-gray-600 mb-6">El curso que buscas no existe o no tienes acceso.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  const estaCompletado = progreso?.estado === "Completado";
  const porcentajeProgreso = calcularPorcentaje();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header fijo */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Volver</span>
            </button>

            <div className="flex items-center gap-4">
              {/* Botón de logout */}
              <button
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Salir</span>
              </button>

              {estaCompletado ? (
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Completado
                </span>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">Tiempo visto</p>
                    <p className="text-sm font-bold text-indigo-600">
                      {formatearTiempo(tiempoVisto)}
                    </p>
                  </div>
                  <button
                    onClick={marcarCompletado}
                    disabled={guardando}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {guardando ? "Guardando..." : "✓ Completar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje de feedback */}
      {mensaje.texto && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4">
          <div className={`p-4 rounded-lg shadow-sm animate-in slide-in-from-top ${
            mensaje.tipo === "success" ? "bg-green-50 border border-green-200 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border border-red-200 text-red-800" :
            "bg-blue-50 border border-blue-200 text-blue-800"
          }`}>
            {mensaje.texto}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Contenido principal - Iframe */}
          <div className="lg:col-span-2 space-y-4">
            {/* Barra de progreso */}
            {!estaCompletado && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progreso del curso</span>
                  <span className="text-sm font-bold text-indigo-600">{porcentajeProgreso}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${porcentajeProgreso}%` }}
                  />
                </div>
              </div>
            )}

            {/* Iframe del curso */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={curso.cursos.url_iframe}
                  className="absolute top-0 left-0 w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  title={curso.cursos.titulo}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - Información del curso */}
          <div className="space-y-4">
            {/* Info del curso */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {curso.cursos.titulo}
                </h1>
                {curso.cursos.descripcion && (
                  <p className="text-gray-600 text-sm">
                    {curso.cursos.descripcion}
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">⏱️ Duración:</span>
                  <span className="font-semibold text-gray-900">
                    {curso.cursos.duracion_minutos} minutos
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">👥 Grupo:</span>
                  <span className="font-semibold text-gray-900">
                    {curso.grupos?.nombre || "No asignado"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">📊 Campaña:</span>
                  <span className="font-semibold text-gray-900">
                    {curso.campañas?.nombre || "No asignada"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">📅 Activado:</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(curso.fecha).toLocaleDateString('es-PE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {progreso && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Tu progreso</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estado:</span>
                      <span className={`font-semibold ${
                        estaCompletado ? "text-green-600" : "text-yellow-600"
                      }`}>
                        {progreso.estado}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Iniciado:</span>
                      <span className="font-semibold text-gray-900">
                        {new Date(progreso.fecha_inicio).toLocaleDateString('es-PE', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                    {progreso.fecha_fin && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completado:</span>
                        <span className="font-semibold text-gray-900">
                          {new Date(progreso.fecha_fin).toLocaleDateString('es-PE', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Consejos */}
            {!estaCompletado && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  💡 Consejos
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span>Toma notas mientras ves el curso</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span>Puedes pausar cuando lo necesites</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span>Tu progreso se guarda automáticamente</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
