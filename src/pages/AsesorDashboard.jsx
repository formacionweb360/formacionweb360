import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AsesorDashboard({ user }) {
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    cargarCursos();
  }, []);

  // Mostrar mensajes con auto-dismiss
  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  const cargarCursos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cursos_asesores")
        .select(`
          id,
          curso_activado_id,
          cursos_activados(
            id, 
            curso_id, 
            fecha, 
            activo,
            grupo_id,
            campana_id,
            cursos(titulo, descripcion, duracion_minutos, url_iframe),
            grupos(nombre),
            campañas(nombre)
          )
        `)
        .eq("asesor_id", user.id)
        .eq("cursos_activados.activo", true)
        .order('cursos_activados(fecha)', { ascending: false });

      if (error) {
        console.error("Error cargando cursos del asesor:", error);
        mostrarMensaje("error", "❌ Error al cargar cursos");
        setCursos([]);
      } else {
        const cursosData = data || [];
        // Filtrar los que tienen cursos_activados válidos
        const cursosValidos = cursosData.filter(c => c.cursos_activados);
        setCursos(cursosValidos);
        
        if (cursosValidos.length === 0) {
          mostrarMensaje("info", "📚 No tienes cursos asignados por ahora");
        }
      }
    } catch (err) {
      console.error("Excepción cargando cursos:", err);
      mostrarMensaje("error", "❌ Error al cargar cursos");
      setCursos([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            👋 Hola, {user.nombre}
          </h1>
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            <span className="bg-white px-3 py-1 rounded-full shadow-sm">
              👤 Asesor
            </span>
            <span className="bg-white px-3 py-1 rounded-full shadow-sm">
              📅 {fechaHoy}
            </span>
          </div>
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

        {/* Panel de cursos */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-xl text-gray-900">
              🎓 Cursos asignados
            </h2>
            {loading && (
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {loading && cursos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Cargando cursos...</p>
            </div>
          ) : cursos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-500 text-lg mb-2">No tienes cursos asignados</p>
              <p className="text-sm text-gray-400">
                Tu formador te asignará cursos pronto. ¡Mantente atento!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cursos.map((c) => {
                const curso = c.cursos_activados;
                const fechaCurso = new Date(curso.fecha).toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <div
                    key={c.id}
                    className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all hover:border-indigo-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900 mb-1">
                              {curso.cursos?.titulo || "Curso sin título"}
                            </h3>
                            <p className="text-xs text-gray-500 mb-2">
                              Activado el {fechaCurso}
                            </p>
                          </div>
                        </div>
                        
                        {curso.cursos?.descripcion && (
                          <p className="text-gray-600 mb-3 text-sm">
                            {curso.cursos.descripcion}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-2 text-sm">
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                            ⏱️ {curso.cursos?.duracion_minutos || 0} minutos
                          </span>
                          {curso.grupos?.nombre && (
                            <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                              👥 {curso.grupos.nombre}
                            </span>
                          )}
                          {curso.campañas?.nombre && (
                            <span className="bg-pink-50 text-pink-700 px-3 py-1 rounded-full">
                              📊 {curso.campañas.nombre}
                            </span>
                          )}
                        </div>
                      </div>

                      <a
                        href={`/curso/${curso.id}`}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <span>Ver curso</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Estadísticas rápidas */}
        {cursos.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
            <h3 className="font-semibold text-gray-900 mb-4">📊 Tu progreso</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Cursos asignados</p>
                <p className="text-2xl font-bold text-indigo-600">{cursos.length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total minutos</p>
                <p className="text-2xl font-bold text-purple-600">
                  {cursos.reduce((acc, c) => acc + (c.cursos_activados?.cursos?.duracion_minutos || 0), 0)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm col-span-2 md:col-span-1">
                <p className="text-sm text-gray-600 mb-1">Último curso</p>
                <p className="text-sm font-bold text-pink-600 truncate">
                  {new Date(cursos[0]?.cursos_activados?.fecha).toLocaleDateString('es-PE', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
