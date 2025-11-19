import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AsesorDashboard({ user, onLogout }) {
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Cambiamos la estructura de progreso para usar cursoId en lugar de cursoActivadoId
  const [progreso, setProgreso] = useState({}); // { cursoId: true/false }

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    cargarCursos();
    cargarProgreso();
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
            cursos(id, titulo, descripcion, duracion_minutos, url_iframe),
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

  const cargarProgreso = async () => {
    const { data, error } = await supabase
      .from("progreso_usuarios")
      .select("curso_id, estado")
      .eq("usuario", user.usuario); // Usamos nombre de usuario

    if (!error && data) {
      const nuevoProgreso = {};
      data.forEach(p => {
        // Si estado es "Completado", lo registramos
        if (p.estado === "Completado") {
          nuevoProgreso[p.curso_id] = true;
        }
      });
      setProgreso(nuevoProgreso);
    }
  };

  const marcarComoCompletado = async (cursoActivadoId) => {
    // Buscar el curso original en la lista de cursos cargados
    const curso = cursos.find(c => c.cursos_activados.id === cursoActivadoId);
    if (!curso) {
      mostrarMensaje("error", "❌ Curso no encontrado");
      return;
    }

    const cursoId = curso.cursos_activados.cursos.id;
    if (progreso[cursoId]) return; // Ya completado

    setLoading(true);
    try {
      const { error } = await supabase
        .from("progreso_usuarios")
        .upsert({
          usuario: user.usuario, // Nombre de usuario
          curso_id: cursoId,     // ID del curso original
          fecha_inicio: new Date().toISOString(),
          progreso: 0, // o el tiempo que hayas visto
          estado: "Completado",
          fecha_fin: new Date().toISOString()
        }, {
          onConflict: 'usuario,curso_id' // Clave única en texto
        });

      if (error) {
        console.error("Error upsert progreso:", error);
        mostrarMensaje("error", "❌ No se pudo marcar como completado");
        return;
      }

      // Actualizar estado local
      setProgreso(prev => ({ ...prev, [cursoId]: true }));
      mostrarMensaje("success", "✅ ¡Felicidades! Curso marcado como completado");
    } catch (err) {
      console.error("Error general al marcar como completado:", err);
      mostrarMensaje("error", "❌ No se pudo marcar como completado");
    } finally {
      setLoading(false);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Menú fijo superior - COMPACTO Y MODERNO */}
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3 md:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-xs">A</span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 text-sm md:text-base">Panel del Asesor</h1>
                <p className="text-xs text-gray-500">Hola, {user.nombre}</p>
              </div>
            </div>

            {/* Botón de menú móvil */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="text-gray-700 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
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
                className="text-gray-700 hover:text-indigo-600 px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1"
              >
                🏠 Inicio
              </button>
              <button 
                onClick={() => window.location.href = '/perfil'}
                className="text-gray-700 hover:text-indigo-600 px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1"
              >
                👤 Perfil
              </button>
              <button
                onClick={onLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-3 py-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium shadow-sm hover:shadow"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Salir
              </button>
            </div>
          </div>

          {/* Menú móvil desplegable */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-3 mt-2">
              <div className="flex flex-col space-y-1">
                <button 
                  onClick={() => {
                    window.location.href = '/dashboard';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md hover:bg-gray-50 text-xs font-medium flex items-center gap-2"
                >
                  🏠 Inicio
                </button>
                <button 
                  onClick={() => {
                    window.location.href = '/perfil';
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md hover:bg-gray-50 text-xs font-medium flex items-center gap-2"
                >
                  👤 Perfil
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md hover:bg-gray-50 text-xs font-medium flex items-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Salir
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-3 md:p-5 pt-4">
        {/* Mensaje de feedback */}
        {mensaje.texto && (
          <div className={`mb-4 p-2.5 rounded-lg shadow-sm border-l-2 ${
            mensaje.tipo === "success" ? "bg-green-50 border-l-green-500 text-green-800" :
            mensaje.tipo === "error" ? "bg-red-50 border-l-red-500 text-red-800" :
            "bg-blue-50 border-l-blue-500 text-blue-800"
          }`}>
            <span className="text-sm font-medium">{mensaje.texto}</span>
          </div>
        )}

        {/* Header principal - más compacto */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">👋 Bienvenido, {user.nombre}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="bg-white px-2.5 py-1 rounded-lg shadow-sm border border-gray-100">
              👤 Asesor
            </span>
            <span className="bg-white px-2.5 py-1 rounded-lg shadow-sm border border-gray-100">
              📅 {fechaHoy}
            </span>
          </div>
        </div>

        {/* Panel de cursos - diseño moderno, compacto */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 101.414-1.414z" clipRule="evenodd" />
                </svg>
                Cursos asignados
              </h2>
              {loading && (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          </div>

          <div className="p-4">
            {loading && cursos.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Cargando tus cursos...</p>
              </div>
            ) : cursos.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-gray-500 text-sm mb-1">No tienes cursos asignados</p>
                <p className="text-xs text-gray-400">Tu formador te asignará cursos pronto. ¡Mantente atento!</p>
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
                  // Usamos el ID del curso original para verificar progreso
                  const completado = progreso[curso.cursos.id] || false;

                  return (
                    <div
                      key={c.id}
                      className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-all hover:border-indigo-200 bg-white"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm md:text-base text-gray-900 mb-1 truncate">
                            {curso.cursos?.titulo || "Curso sin título"}
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            Activado el {fechaCurso}
                          </p>

                          {curso.cursos?.descripcion && (
                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                              {curso.cursos.descripcion}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                              ⏱️ {curso.cursos?.duracion_minutos || 0} min
                            </span>
                            {curso.grupos?.nombre && (
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                👥 {curso.grupos.nombre}
                              </span>
                            )}
                            {curso.campañas?.nombre && (
                              <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                📊 {curso.campañas.nombre}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`/curso/${curso.id}`}
                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-3 py-1.5 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all font-medium shadow-sm hover:shadow text-xs flex items-center gap-1 whitespace-nowrap"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Ver curso
                          </a>

                          {/* Botón de completado */}
                          <button
                            onClick={() => marcarComoCompletado(curso.id)}
                            disabled={completado}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              completado
                                ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title={completado ? "Ya completado" : "Marcar como completado"}
                          >
                            {completado ? (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Completado
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Completar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Estadísticas rápidas - más limpias y con mejor UX */}
        {cursos.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-1">
              <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 101.414-1.414z" clipRule="evenodd" />
              </svg>
              Tu progreso
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xs text-gray-500 mb-1">Cursos</p>
                <p className="text-lg font-bold text-indigo-600">{cursos.length}</p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xs text-gray-500 mb-1">Minutos totales</p>
                <p className="text-lg font-bold text-purple-600">
                  {cursos.reduce((acc, c) => acc + (c.cursos_activados?.cursos?.duracion_minutos || 0), 0)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-xs text-gray-500 mb-1">Completados</p>
                <p className="text-lg font-bold text-green-600">
                  {Object.values(progreso).filter(v => v).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
