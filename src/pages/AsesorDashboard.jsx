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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Menú fijo superior - minimalista y funcional */}
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3 md:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-xs md:text-sm truncate max-w-[100px] md:max-w-none">
                  Hola, {user.nombre}
                </p>
                <p className="text-xs text-gray-500 hidden md:block">Panel del Asesor</p>
              </div>
            </div>

            {/* Botón de menú móvil */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="text-gray-700 hover:text-indigo-600 p-2 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Menú desktop */}
            <div className="hidden md:flex items-center space-x-2">
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
              >
                🏠 Inicio
              </button>
              <button 
                onClick={() => window.location.href = '/perfil'}
                className="text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
              >
                👤 Perfil
              </button>
              <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition text-xs font-medium"
              >
                Salir
              </button>
            </div>
          </div>

          {/* Menú móvil desplegable */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-3 mt-1">
              <div className="flex flex-col space-y-1">
                <button 
                  onClick={() => {
                    window.location.href = '/dashboard';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-left"
                >
                  🏠 Inicio
                </button>
                <button 
                  onClick={() => {
                    window.location.href = '/perfil';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-left"
                >
                  👤 Perfil
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 text-sm font-medium text-left"
                >
                  🔐 Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-3 md:px-6 pt-4 pb-6">
        {/* Mensaje de feedback */}
        {mensaje.texto && (
          <div className={`mb-4 p-3 rounded-lg shadow-sm border-l-4 ${
            mensaje.tipo === "success" ? "bg-green-50 border-l-green-500 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border-l-red-500 text-red-800" :
            "bg-blue-50 border-l-blue-500 text-blue-800"
          }`}>
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        )}

        {/* Header principal */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">👋 Bienvenido</h1>
          <p className="text-gray-600 text-sm">Tienes <span className="font-semibold text-indigo-600">{cursos.length}</span> cursos activos</p>
          <div className="mt-2 flex gap-2 text-xs text-gray-500">
            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">📅 {fechaHoy}</span>
          </div>
        </div>

        {/* Estadísticas rápidas - arriba en móvil, abajo en escritorio */}
        {cursos.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-1">
              📊 Tu progreso
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Total</p>
                <p className="text-lg font-bold text-indigo-600">{cursos.length}</p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Minutos</p>
                <p className="text-lg font-bold text-purple-600">
                  {cursos.reduce((acc, c) => acc + (c.cursos_activados?.cursos?.duracion_minutos || 0), 0)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Último</p>
                <p className="text-base font-bold text-pink-600">
                  {new Date(cursos[0]?.cursos_activados?.fecha).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Panel de cursos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm md:text-base flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Cursos asignados
            </h2>
            {loading && (
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {loading && cursos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-sm">Cargando cursos...</p>
            </div>
          ) : cursos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="text-5xl mb-3">📚</div>
              <p className="text-gray-500 text-sm mb-1">No tienes cursos asignados</p>
              <p className="text-xs text-gray-400">Tu formador te asignará pronto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cursos.map((c) => {
                const curso = c.cursos_activados;
                const fechaCurso = new Date(curso.fecha).toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <a
                    key={c.id}
                    href={`/curso/${curso.id}`}
                    className="block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:border-indigo-200"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-gray-900 mb-1 truncate">
                            {curso.cursos?.titulo || "Curso sin título"}
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            Activado el {fechaCurso}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                              ⏱️ {curso.cursos?.duracion_minutos || 0} min
                            </span>
                            {curso.grupos?.nombre && (
                              <span className="bg-purple-100 text-purple-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                👥 {curso.grupos.nombre}
                              </span>
                            )}
                            {curso.campañas?.nombre && (
                              <span className="bg-pink-100 text-pink-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                📊 {curso.campañas.nombre}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-full ml-3 shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
