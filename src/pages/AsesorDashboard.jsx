import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AsesorDashboard({ user, onLogout }) {
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    cargarCursos();
  }, []);

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

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Menú fijo superior */}
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 text-lg">Panel del Asesor</h1>
                <p className="text-xs text-gray-500">Hola, {user.nombre}</p>
              </div>
            </div>
            
            {/* Botón de menú para móviles */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="text-gray-700 hover:text-indigo-600 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Opciones de menú para desktop */}
            <div className="hidden md:flex items-center space-x-3">
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="text-gray-700 hover:text-indigo-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                🏠 Inicio
              </button>
              <button 
                onClick={() => window.location.href = '/perfil'}
                className="text-gray-700 hover:text-indigo-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                👤 Perfil
              </button>
              <button
                onClick={onLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* Menú desplegable para móviles */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-4">
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={() => {
                    window.location.href = '/dashboard';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-indigo-600 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2 text-left"
                >
                  🏠 Inicio
                </button>
                <button 
                  onClick={() => {
                    window.location.href = '/perfil';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-indigo-600 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2 text-left"
                >
                  👤 Perfil
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-red-600 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2 text-left"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 md:p-6 pt-6">
        {/* Mensaje de feedback */}
        {mensaje.texto && (
          <div className={`mb-6 p-4 rounded-xl shadow-sm border-l-4 ${
            mensaje.tipo === "success" ? "bg-green-50 border-l-green-500 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border-l-red-500 text-red-800" :
            "bg-blue-50 border-l-blue-500 text-blue-800"
          }`}>
            <div className="flex items-center">
              <span className="font-medium">{mensaje.texto}</span>
            </div>
          </div>
        )}

        {/* Header principal */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            👋 Bienvenido, {user.nombre}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              👤 Asesor
            </span>
            <span className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              📅 {fechaHoy}
            </span>
          </div>
        </div>

        {/* Panel de cursos */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-xl text-gray-900 flex items-center gap-2">
                🎓 Cursos asignados
              </h2>
              {loading && (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading && cursos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Cargando cursos...</p>
              </div>
            ) : cursos.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-500 text-lg mb-2">No tienes cursos asignados</p>
                <p className="text-sm text-gray-400">
                  Tu formador te asignará cursos pronto. ¡Mantente atento!
                </p>
              </div>
            ) : (
              <div className="space-y-5">
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
                      className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all hover:border-indigo-300 bg-gradient-to-r from-white to-gray-50"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div className="flex-1">
                          <div className="flex items-start gap-4 mb-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                                {curso.cursos?.titulo || "Curso sin título"}
                              </h3>
                              <p className="text-xs text-gray-500 mb-3">
                                Activado el {fechaCurso}
                              </p>
                            </div>
                          </div>
                          
                          {curso.cursos?.descripcion && (
                            <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                              {curso.cursos.descripcion}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium">
                              ⏱️ {curso.cursos?.duracion_minutos || 0} min
                            </span>
                            {curso.grupos?.nombre && (
                              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">
                                👥 {curso.grupos.nombre}
                              </span>
                            )}
                            {curso.campañas?.nombre && (
                              <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-medium">
                                📊 {curso.campañas.nombre}
                              </span>
                            )}
                          </div>
                        </div>

                        <a
                          href={`/curso/${curso.id}`}
                          className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all font-medium shadow-md hover:shadow-xl flex items-center justify-center gap-2 whitespace-nowrap"
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
        </div>

        {/* Estadísticas rápidas */}
        {cursos.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
            <h3 className="font-semibold text-gray-900 mb-4 text-lg">📊 Tu progreso</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Cursos asignados</p>
                <p className="text-3xl font-bold text-indigo-600">{cursos.length}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Total minutos</p>
                <p className="text-3xl font-bold text-purple-600">
                  {cursos.reduce((acc, c) => acc + (c.cursos_activados?.cursos?.duracion_minutos || 0), 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Último curso</p>
                <p className="text-xl font-bold text-pink-600">
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
