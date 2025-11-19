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
      console.log("🔄 Cargando cursos para usuario:", user.usuario); // 👈 LOG 1

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
        console.error("❌ Error cargando cursos del asesor:", error);
        mostrarMensaje("error", "❌ Error al cargar cursos");
        setCursos([]);
      } else {
        const cursosData = data || [];
        const cursosValidos = cursosData.filter(c => c.cursos_activados);
        
        // Cargar progreso para cada curso
        const cursosConProgreso = await Promise.all(
          cursosValidos.map(async (c) => {
            const cursoId = c.cursos_activados.curso_id;
            console.log(`🔍 Buscando progreso para curso_id=${cursoId} y usuario=${user.usuario}`); // 👈 LOG 2

            // ⚠️ Convertimos cursoId a número
            const cursoIdNum = parseInt(cursoId, 10);
            if (isNaN(cursoIdNum)) {
              console.warn("⚠️ curso_id no es un número válido:", cursoId);
              return { ...c, completado: false };
            }

            const {  progresoData, error: errorProgreso } = await supabase
              .from("progreso_usuarios")
              .select("estado")
              .eq("usuario", user.usuario)
              .eq("curso_id", cursoIdNum) // ✅ Ahora como número
              .single();

            if (errorProgreso) {
              console.error("❌ Error al cargar progreso:", errorProgreso);
            }

            console.log("📦 Progreso encontrado:", progresoData); // 👈 LOG 3

            // Comparar estado de forma tolerante
            const estadoLimpio = progresoData?.estado?.trim()?.toLowerCase();
            const completado = estadoLimpio === "completado";
            
            console.log("✅ Estado limpio:", estadoLimpio, "| Completado:", completado); // 👈 LOG 4

            return { ...c, completado };
          })
        );

        setCursos(cursosConProgreso);
        
        if (cursosConProgreso.length === 0) {
          mostrarMensaje("info", "📚 No tienes cursos asignados por ahora");
        }
      }
    } catch (err) {
      console.error("❌ Excepción cargando cursos:", err);
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

      {/* Menú fijo superior - refinado */}
      <nav className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3 md:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div className="relative">
                <p className="font-semibold text-white text-xs md:text-sm truncate max-w-[100px] md:max-w-none hover:text-purple-400 transition-colors duration-300">
                  Hola, {user.nombre}
                </p>
                <p className="text-xs text-gray-400 hidden md:block">Panel del Asesor</p>
              </div>
            </div>

            {/* Botón de menú móvil */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="text-white hover:text-purple-400 p-2 rounded-lg transition-colors"
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
                className="text-gray-300 hover:text-purple-400 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all duration-300 text-xs font-medium"
              >
                🏠 Inicio
              </button>
              <button 
                onClick={() => window.location.href = '/perfil'}
                className="text-gray-300 hover:text-purple-400 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all duration-300 text-xs font-medium"
              >
                👤 Perfil
              </button>
              <button
                onClick={onLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-lg transition-all duration-300 text-xs font-medium hover:shadow-lg hover:shadow-red-500/20"
              >
                Salir
              </button>
            </div>
          </div>

          {/* Menú móvil desplegable */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-white/10 py-3 mt-1">
              <div className="flex flex-col space-y-1">
                <button 
                  onClick={() => {
                    window.location.href = '/dashboard';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-300 hover:text-purple-400 px-3 py-2 rounded-lg hover:bg-white/10 text-sm font-medium text-left transition-colors"
                >
                  🏠 Inicio
                </button>
                <button 
                  onClick={() => {
                    window.location.href = '/perfil';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-300 hover:text-purple-400 px-3 py-2 rounded-lg hover:bg-white/10 text-sm font-medium text-left transition-colors"
                >
                  👤 Perfil
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm font-medium text-left transition-colors"
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
          <div className={`mb-4 p-3 rounded-lg shadow-sm border-l-4 animate-in slide-in-from-top duration-500 ${
            mensaje.tipo === "success" ? "bg-green-500/20 border-l-green-400 text-green-200" :
            mensaje.tipo === "error" ? "bg-red-500/20 border-l-red-400 text-red-200" :
            "bg-blue-500/20 border-l-blue-400 text-blue-200"
          }`}>
            <p className="text-sm">{mensaje.texto}</p>
          </div>
        )}

        {/* Header principal */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">👋 Bienvenido</h1>
          <p className="text-gray-300 text-sm">Tienes <span className="font-semibold text-purple-400">{cursos.length}</span> cursos activos</p>
          <div className="mt-2 flex gap-2 text-xs text-gray-400">
            <span className="bg-white/10 text-white px-2 py-1 rounded-full">📅 {fechaHoy}</span>
          </div>
        </div>

        {/* Estadísticas rápidas - refinadas */}
        {cursos.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mb-6 shadow-xl shadow-purple-500/5">
            <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-1">
              <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Tu progreso
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/10 rounded-lg p-3 shadow-sm border border-white/20 backdrop-blur-sm">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-lg font-bold text-purple-400">{cursos.length}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 shadow-sm border border-white/20 backdrop-blur-sm">
                <p className="text-xs text-gray-400 mb-1">Minutos</p>
                <p className="text-lg font-bold text-pink-400">
                  {cursos.reduce((acc, c) => acc + (c.cursos_activados?.cursos?.duracion_minutos || 0), 0)}
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 shadow-sm border border-white/20 backdrop-blur-sm">
                <p className="text-xs text-gray-400 mb-1">Completados</p>
                <p className="text-lg font-bold text-cyan-400">
                  {cursos.filter(c => c.completado).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Panel de cursos - animado y refinado */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
              Cursos asignados
            </h2>
            {loading && (
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {loading && cursos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400 text-sm">Cargando tus cursos...</p>
            </div>
          ) : cursos.length === 0 ? (
            <div className="text-center py-12 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shadow-xl shadow-purple-500/5">
              <div className="text-5xl mb-3 text-gray-500">📚</div>
              <p className="text-gray-400 text-sm mb-1">No tienes cursos asignados</p>
              <p className="text-xs text-gray-500">Tu formador te asignará pronto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cursos.map((c, index) => {
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
                    className={`block bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl shadow-purple-500/5 hover:shadow-2xl hover:border-purple-400/50 transition-all duration-500 ease-out hover:scale-[1.01] animate-in slide-in-from-bottom-20 duration-700 delay-[100ms] ${
                      c.completado ? 'border-green-500/50' : ''
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm text-white truncate">
                              {curso.cursos?.titulo || "Curso sin título"}
                            </h3>
                            {c.completado && (
                              <span className="bg-green-500/20 text-green-300 text-xs font-medium px-2 py-0.5 rounded-full border border-green-500/30">
                                ✅ Completado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mb-2">
                            Activado el {fechaCurso}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
                              ⏱️ {curso.cursos?.duracion_minutos || 0} min
                            </span>
                            {curso.grupos?.nombre && (
                              <span className="bg-purple-500/20 text-purple-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-purple-500/30">
                                👥 {curso.grupos.nombre}
                              </span>
                            )}
                            {curso.campañas?.nombre && (
                              <span className="bg-pink-500/20 text-pink-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-pink-500/30">
                                📊 {curso.campañas.nombre}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full ml-3 shrink-0 group">
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Footer flotante sutil */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <p className="text-xs text-gray-500 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          © 2025 | Panel del Asesor • Diseñado para ti
        </p>
      </div>
    </div>
  );
}
