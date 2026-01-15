import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Users, TrendingUp, Calendar, Search, Eye, EyeOff, BarChart3 } from "lucide-react";
import { supabase } from "../services/supabaseClient";

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
  "ASISTIÓ": { label: "Asistió", color: "bg-emerald-500", text: "text-emerald-700", bgLight: "bg-emerald-50", border: "border-emerald-200", icon: "✓" },
  "FALTA": { label: "Falta", color: "bg-rose-500", text: "text-rose-700", bgLight: "bg-rose-50", border: "border-rose-200", icon: "✗" },
  "TARDANZA": { label: "Tardanza", color: "bg-amber-500", text: "text-amber-700", bgLight: "bg-amber-50", border: "border-amber-200", icon: "⏰" },
  "DESERTÓ": { label: "Desertó", color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-50", border: "border-purple-200", icon: "↪" },
  "NO SE PRESENTÓ": { label: "No se presentó", color: "bg-slate-500", text: "text-slate-700", bgLight: "bg-slate-50", border: "border-slate-200", icon: "○" },
  "RETIRADO": { label: "Retirado", color: "bg-orange-500", text: "text-orange-700", bgLight: "bg-orange-50", border: "border-orange-200", icon: "⊗" },
  "NO APROBO ROLE PLAY": { label: "No aprobó RP", color: "bg-blue-500", text: "text-blue-700", bgLight: "bg-blue-50", border: "border-blue-200", icon: "◐" },
};

export default function AdminPage({ user }) {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [mostrarTabla, setMostrarTabla] = useState(false);

  // Solo ejecutar si ya sabemos quién es el usuario
  useEffect(() => {
    // Si aún no sabemos si hay usuario, no hacer nada
    if (user === undefined) {
      return;
    }

    // Si no es administrador, detener
    if (user?.rol !== "Administrador") {
      setLoading(false);
      return;
    }

    // Cargar datos solo para administradores
    let isSubscribed = true;

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

        if (isSubscribed) {
          setUsuarios(data || []);
          const gruposUnicos = [...new Set(data.map(u => u.grupo_nombre).filter(Boolean))];
          setGrupos(gruposUnicos.sort());
        }
      } catch (err) {
        console.error("Error al cargar dotación:", err);
        if (isSubscribed) {
          setUsuarios([]);
          setGrupos([]);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchDotacion();

    return () => {
      isSubscribed = false;
    };
  }, [user]);

  // --- Memoizados ---
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

  const statsGlobales = useMemo(() => {
    const total = usuariosFiltrados.length;
    const activos = usuariosFiltrados.filter(u => u.estado === "Activo").length;
    let totalAsistencias = 0, totalFaltas = 0, totalTardanzas = 0;
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

  // --- Renderizado ---

  // Mientras se determina la identidad del usuario
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
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-rose-600 mb-2">Acceso restringido</h2>
          <p className="text-gray-600">Solo los administradores pueden ver este panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
                <BarChart3 className="w-9 h-9" />
                Dashboard de Asistencia
              </h1>
              <p className="text-indigo-100 mt-1">Monitoreo en tiempo real del equipo</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-2.5 border border-white/30 text-center">
              <p className="text-xs text-indigo-100">Filtro actual</p>
              <p className="font-bold">{filtroGrupo === "todos" ? "Todos los grupos" : filtroGrupo}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Usuarios", value: statsGlobales.total, icon: <Users className="w-5 h-5" />, color: "text-indigo-200" },
              { label: "Activos", value: statsGlobales.activos, icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-200" },
              { label: "Tasa Asistencia", value: `${statsGlobales.tasaAsistencia}%`, icon: <Calendar className="w-5 h-5" />, color: "text-amber-200" },
              { label: "Asistencias", value: statsGlobales.totalAsistencias, icon: "✓", color: "text-green-200" }
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-1">
                  {typeof stat.icon === 'string' ? 
                    <span className="text-xl">{stat.icon}</span> : 
                    React.cloneElement(stat.icon, { className: `w-5 h-5 ${stat.color}` })
                  }
                  <p className="text-sm text-indigo-100">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar usuario</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o usuario..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filtrar por grupo</label>
              <div className="relative">
                <select
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="todos">Todos los grupos</option>
                  {grupos.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setMostrarTabla(!mostrarTabla)}
                className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium shadow hover:shadow-md transition flex items-center justify-center gap-2"
              >
                {mostrarTabla ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                {mostrarTabla ? "Ocultar detalle" : "Ver detalle"}
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas por día */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3, 4, 5, 6].map(dia => {
            const totalDia = Object.values(statsPorDia[dia]).reduce((a, b) => a + b, 0);
            return (
              <div key={dia} className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 px-5">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold">Día {dia}</h3>
                    <span className="bg-white/20 px-2.5 py-1 rounded-full text-xs font-medium">{totalDia} registros</span>
                  </div>
                </div>
                <div className="p-4 space-y-2.5">
                  {OPCIONES_ASISTENCIA.map(estado => {
                    const count = statsPorDia[dia][estado] || 0;
                    const config = ESTADO_CONFIG[estado];
                    const pct = totalDia > 0 ? Math.round((count / totalDia) * 100) : 0;
                    return count > 0 ? (
                      <div key={estado} className={`${config.bgLight} ${config.border} border rounded-lg p-2.5`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
                          <span className={`text-xs ${config.text} opacity-75`}>{pct}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className={`h-full ${config.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className={`ml-2 min-w-[1.5rem] text-center text-xs font-bold ${config.color} text-white rounded`}>
                            {count}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })}
                  {totalDia === 0 && (
                    <p className="text-gray-500 text-center text-sm py-4">Sin registros</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabla detallada */}
        {mostrarTabla && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-slate-800 text-white px-6 py-4">
              <h3 className="font-bold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Detalle por Usuario
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Usuario</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Grupo</th>
                    {[1,2,3,4,5,6].map(i => (
                      <th key={i} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Día {i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usuariosFiltrados.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{u.nombre}</div>
                        <div className="text-xs text-gray-500">{u.usuario}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                          {u.grupo_nombre}
                        </span>
                      </td>
                      {[1,2,3,4,5,6].map(i => {
                        const val = u[`dia_${i}`];
                        const cfg = val ? ESTADO_CONFIG[val] : null;
                        return (
                          <td key={i} className="px-4 py-4 text-center">
                            {cfg ? (
                              <span className={`inline-flex items-center justify-center w-7 h-7 ${cfg.color} text-white text-xs rounded-full`}>
                                {cfg.icon}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
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

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-lg flex flex-col items-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
              <p className="text-gray-700 font-medium">Cargando datos...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}s
