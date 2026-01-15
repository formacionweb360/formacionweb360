import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Users, TrendingUp, Calendar, Search, Eye, EyeOff, BarChart3 } from "lucide-react";
import { supabase } from "../services/supabaseClient"; // ← Asegúrate de tener este archivo

const OPCIONES_ASISTENCIA = [
  "ASISTIÓ",
  "FALTA",
  "DESERTÓ",
  "TARDANZA",
  "NO SE PRESENTÓ",
  "RETIRADO",
  "NO APROBO ROLE PLAY"
];

const ESTADO_CONFIG = {
  "ASISTIÓ": { 
    label: "Asistió", 
    color: "bg-emerald-500", 
    text: "text-emerald-700",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "✓"
  },
  "FALTA": { 
    label: "Falta", 
    color: "bg-rose-500", 
    text: "text-rose-700",
    bgLight: "bg-rose-50",
    border: "border-rose-200",
    icon: "✗"
  },
  "TARDANZA": { 
    label: "Tardanza", 
    color: "bg-amber-500", 
    text: "text-amber-700",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    icon: "⏰"
  },
  "DESERTÓ": { 
    label: "Desertó", 
    color: "bg-purple-500", 
    text: "text-purple-700",
    bgLight: "bg-purple-50",
    border: "border-purple-200",
    icon: "↪"
  },
  "NO SE PRESENTÓ": { 
    label: "No se presentó", 
    color: "bg-slate-500", 
    text: "text-slate-700",
    bgLight: "bg-slate-50",
    border: "border-slate-200",
    icon: "○"
  },
  "RETIRADO": { 
    label: "Retirado", 
    color: "bg-orange-500", 
    text: "text-orange-700",
    bgLight: "bg-orange-50",
    border: "border-orange-200",
    icon: "⊗"
  },
  "NO APROBO ROLE PLAY": { 
    label: "No aprobó RP", 
    color: "bg-blue-500", 
    text: "text-blue-700",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    icon: "◐"
  },
};

export default function AdminPage({ user }) {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarTabla, setMostrarTabla] = useState(false);

  // Manejo seguro de autenticación y carga
  useEffect(() => {
    // Si user aún no está definido (cargando sesión), no hacer nada
    if (user === undefined) return;

    // Si no es administrador, detener carga
    if (user?.rol !== "Administrador") {
      setLoading(false);
      return;
    }

    const fetchDotacion = async () => {
      try {
        const { data, error } = await supabase
          .from("usuarios")
          .select(`
            id,
            nombre,
            usuario,
            grupo_nombre,
            estado,
            dia_1,
            dia_2,
            dia_3,
            dia_4,
            dia_5,
            dia_6
          `)
          .order("nombre", { ascending: true });

        if (error) throw error;

        setUsuarios(data || []);
        const gruposUnicos = [...new Set(data.map(u => u.grupo_nombre).filter(Boolean))];
        setGrupos(gruposUnicos.sort());
      } catch (err) {
        console.error("Error al cargar dotación desde Supabase:", err);
        setUsuarios([]);
        setGrupos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDotacion();
  }, [user]);

  // Filtros: grupo + búsqueda
  const usuariosFiltrados = useMemo(() => {
    let filtered = usuarios;
    
    if (filtroGrupo !== "todos") {
      filtered = filtered.filter(u => u.grupo_nombre === filtroGrupo);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(u => 
        u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.usuario?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [usuarios, filtroGrupo, searchTerm]);

  // Estadísticas por día
  const statsPorDia = useMemo(() => {
    const stats = {};
    [1, 2, 3, 4, 5, 6].forEach(dia => {
      const key = `dia_${dia}`;
      const conteo = {};
      OPCIONES_ASISTENCIA.forEach(op => conteo[op] = 0);

      usuariosFiltrados.forEach(u => {
        const valor = u[key];
        if (valor && OPCIONES_ASISTENCIA.includes(valor)) {
          conteo[valor] += 1;
        }
      });
      stats[dia] = conteo;
    });
    return stats;
  }, [usuariosFiltrados]);

  // Estadísticas globales
  const statsGlobales = useMemo(() => {
    const total = usuariosFiltrados.length;
    const activos = usuariosFiltrados.filter(u => u.estado === "Activo").length;
    
    let totalAsistencias = 0;
    let totalFaltas = 0;
    let totalTardanzas = 0;

    usuariosFiltrados.forEach(u => {
      for (let i = 1; i <= 6; i++) {
        const dia = u[`dia_${i}`];
        if (dia === "ASISTIÓ") totalAsistencias++;
        else if (dia === "FALTA") totalFaltas++;
        else if (dia === "TARDANZA") totalTardanzas++;
      }
    });

    const totalRegistros = totalAsistencias + totalFaltas + totalTardanzas;
    const tasaAsistencia = totalRegistros > 0 ? ((totalAsistencias / totalRegistros) * 100).toFixed(1) : 0;

    return { total, activos, totalAsistencias, totalFaltas, totalTardanzas, tasaAsistencia };
  }, [usuariosFiltrados]);

  // Mientras se resuelve la identidad del usuario (común en Next.js + Supabase)
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Acceso denegado
  if (user?.rol !== "Administrador") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-10 text-center max-w-md">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚫</span>
          </div>
          <h1 className="text-3xl font-bold text-rose-600 mb-3">Acceso denegado</h1>
          <p className="text-gray-600">Solo los administradores pueden ver este panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <BarChart3 className="w-10 h-10" />
                Dashboard de Asistencia
              </h1>
              <p className="text-indigo-100 text-lg">Monitoreo en tiempo real del equipo</p>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/30">
                <p className="text-sm text-indigo-100">Filtro actual</p>
                <p className="text-xl font-bold">{filtroGrupo === "todos" ? "Todos" : filtroGrupo}</p>
              </div>
            </div>
          </div>

          {/* Stats cards en el header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 transition hover:bg-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-indigo-200" />
                <p className="text-sm text-indigo-100">Total Usuarios</p>
              </div>
              <p className="text-3xl font-bold">{statsGlobales.total}</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 transition hover:bg-white/20">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-200" />
                <p className="text-sm text-indigo-100">Activos</p>
              </div>
              <p className="text-3xl font-bold text-emerald-300">{statsGlobales.activos}</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 transition hover:bg-white/20">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-amber-200" />
                <p className="text-sm text-indigo-100">Tasa Asistencia</p>
              </div>
              <p className="text-3xl font-bold text-amber-300">{statsGlobales.tasaAsistencia}%</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 transition hover:bg-white/20">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">✓</span>
                <p className="text-sm text-indigo-100">Total Asistencias</p>
              </div>
              <p className="text-3xl font-bold text-green-300">{statsGlobales.totalAsistencias}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filtros mejorados */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar usuario</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o usuario..."
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
            </div>
            
            <div className="flex-1 w-full">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filtrar por grupo</label>
              <div className="relative">
                <select
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className="w-full appearance-none px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white cursor-pointer"
                >
                  <option value="todos">Todos los grupos</option>
                  {grupos.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-shrink-0 w-full md:w-auto">
              <label className="block text-sm font-semibold text-gray-700 mb-2">&nbsp;</label>
              <button
                onClick={() => setMostrarTabla(!mostrarTabla)}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
              >
                {mostrarTabla ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                {mostrarTabla ? "Ocultar detalle" : "Ver detalle"}
              </button>
            </div>
          </div>
        </div>

        {/* Grillas por día - Diseño mejorado */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3, 4, 5, 6].map(dia => {
            const totalDia = Object.values(statsPorDia[dia]).reduce((a, b) => a + b, 0);
            
            return (
              <div key={dia} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 px-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xl">Día {dia}</h3>
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold border border-white/30">
                      {totalDia} registros
                    </span>
                  </div>
                </div>
                
                <div className="p-5 space-y-3">
                  {OPCIONES_ASISTENCIA.map(estado => {
                    const count = statsPorDia[dia][estado] || 0;
                    const config = ESTADO_CONFIG[estado];
                    const porcentaje = totalDia > 0 ? ((count / totalDia) * 100).toFixed(0) : 0;
                    
                    return count > 0 ? (
                      <div key={estado} className={`${config.bgLight} ${config.border} border rounded-xl p-3 transition hover:shadow-md`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config.icon}</span>
                            <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${config.text} opacity-75`}>{porcentaje}%</span>
                            <span className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg ${config.color} text-white text-sm font-bold shadow-sm`}>
                              {count}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${config.color} transition-all duration-500 rounded-full`}
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                    ) : null;
                  })}
                  
                  {totalDia === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-3xl opacity-50">📋</span>
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Sin registros</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabla detallada (condicional) */}
        {mostrarTabla && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white py-4 px-6">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Users className="w-6 h-6" />
                Detalle por Usuario
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Grupo</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Día 1</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Día 2</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Día 3</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Día 4</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Día 5</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Día 6</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usuariosFiltrados.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                            {u.nombre.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{u.nombre}</p>
                            <p className="text-xs text-gray-500">{u.usuario}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {u.grupo_nombre}
                        </span>
                      </td>
                      {[1, 2, 3, 4, 5, 6].map(dia => {
                        const valor = u[`dia_${dia}`];
                        const config = valor ? ESTADO_CONFIG[valor] : null;
                        return (
                          <td key={dia} className="px-6 py-4 text-center">
                            {config ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${config.color} text-white shadow-sm`}>
                                {config.icon}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Indicador de carga global (solo durante carga inicial) */}
        {loading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-700 font-semibold">Cargando datos...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
