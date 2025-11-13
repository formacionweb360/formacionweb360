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

  // 🔄 Contador de minutos de visualización
  useEffect(() => {
    let interval;
    if (iniciado && progreso?.estado !== "Completado") {
      interval = setInterval(() => {
        setTiempoVisto((prev) => prev + 1);
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [iniciado, progreso]);

  // 🔁 Cargar datos al entrar o cambiar el curso
  useEffect(() => {
    cargarDatos();
  }, [id]);

  useEffect(() => {
    if (curso && !iniciado) setIniciado(true);
  }, [curso]);

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  // 🧠 Cargar curso y progreso
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

        if (!errorNuevo) setProgreso(nuevoProgreso);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
      mostrarMensaje("error", "❌ Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  // 💾 Guardar progreso automático
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

  // 🏁 Marcar completado
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
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      console.error("Error marcando completado:", err);
      mostrarMensaje("error", "❌ Error inesperado");
    } finally {
      setGuardando(false);
    }
  };

  // 🕒 Utilidades
  const formatearTiempo = (minutos) => {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}min` : `${mins} min`;
  };

  const calcularPorcentaje = () => {
    if (!curso) return 0;
    const duracion = curso.cursos.duracion_minutos || 30;
    const porcentaje = Math.min((tiempoVisto / duracion) * 100, 100);
    return Math.round(porcentaje);
  };

  // ⚙️ Manejo de estados de carga
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
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

  // ✅ Detección de tipos de iframe
  const url = curso.cursos.url_iframe || "";
  const esCanva = url.includes("canva.com");
  const esGoogleSlides = url.includes("docs.google.com/presentation");
  const esYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  const estaCompletado = progreso?.estado === "Completado";
  const porcentajeProgreso = calcularPorcentaje();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Volver</span>
          </button>

          <div className="flex items-center gap-4">
            {/* 🔴 Logout */}
            <button
              onClick={onLogout}
              className="text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mensaje de feedback */}
      {mensaje.texto && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4">
          <div
            className={`p-4 rounded-lg shadow-sm ${
              mensaje.tipo === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : mensaje.tipo === "error"
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            {mensaje.texto}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid lg:grid-cols-3 gap-6">
        {/* Iframe o enlace */}
        <div className="lg:col-span-2 space-y-4">
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

          {/* 🔹 Render dinámico según tipo */}
          <div
            className="bg-white rounded-2xl shadow-lg overflow-hidden relative w-full"
            style={{ paddingTop: "56.25%" }}
          >
            {esCanva ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 border border-gray-200">
                <p className="text-gray-700 mb-4 text-center px-4">
                  Canva no permite mostrar el contenido incrustado directamente.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Abrir curso en Canva ↗
                </a>
              </div>
            ) : esGoogleSlides ? (
              <iframe
                src={url}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; fullscreen"
                title={curso.cursos.titulo}
              />
            ) : esYouTube ? (
              <iframe
                src={url.replace("watch?v=", "embed/")}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={curso.cursos.titulo}
              />
            ) : (
              <iframe
                src={url}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                title={curso.cursos.titulo}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">{curso.cursos.titulo}</h1>
            {curso.cursos.descripcion && <p className="text-gray-600 text-sm">{curso.cursos.descripcion}</p>}

            <div className="border-t border-gray-200 pt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Duración:</span>
                <span className="font-semibold">{curso.cursos.duracion_minutos} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Grupo:</span>
                <span className="font-semibold">{curso.grupos?.nombre || "No asignado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Campaña:</span>
                <span className="font-semibold">{curso.campañas?.nombre || "No asignada"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
