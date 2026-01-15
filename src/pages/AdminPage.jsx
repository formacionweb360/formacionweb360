import { useEffect, useMemo, useState } from "react";
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
  "ASISTIÓ": { label: "Asistió", color: "bg-emerald-500", text: "text-emerald-800" },
  "FALTA": { label: "Falta", color: "bg-rose-500", text: "text-rose-800" },
  "TARDANZA": { label: "Tardanza", color: "bg-amber-500", text: "text-amber-800" },
  "DESERTÓ": { label: "Desertó", color: "bg-purple-500", text: "text-purple-800" },
  "NO SE PRESENTÓ": { label: "No se presentó", color: "bg-slate-600", text: "text-slate-800" },
  "RETIRADO": { label: "Retirado", color: "bg-orange-500", text: "text-orange-800" },
  "NO APROBO ROLE PLAY": { label: "No aprobó RP", color: "bg-blue-500", text: "text-blue-800" },
};

export default function AdminPage({ user }) {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [loading, setLoading] = useState(true);

  // Manejo seguro de autenticación (evita errores en Vercel al cargar)
  useEffect(() => {
    if (user === undefined) {
      setLoading(false);
      return;
    }

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
        console.error("Error al cargar dotación:", err);
        setUsuarios([]);
        setGrupos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDotacion();
  }, [user]);

  const usuariosFiltrados = useMemo(() => {
    if (filtroGrupo === "todos") return usuarios;
    return usuarios.filter(u => u.grupo_nombre === filtroGrupo);
  }, [usuarios, filtroGrupo]);

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

  const totalActivos = usuariosFiltrados.filter(u => u.estado === "Activo").length;
  const totalUsuarios = usuariosFiltrados.length;

  // Mientras se resuelve la sesión (común en Vercel)
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Acceso denegado
  if (user?.rol !== "Administrador") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600">🔒 Acceso restringido</h1>
          <p className="text-gray-600 mt-2">
            Solo los administradores pueden acceder al dashboard de asistencia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-800">📊 Dashboard de Asistencia</h1>
          <p className="text-slate-600 mt-2">Resumen general por día del curso</p>
        </div>

        {/* Resumen global */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5 text-center border border-slate-200">
            <p className="text-slate-600 text-sm">Total de usuarios</p>
            <p className="text-2xl font-bold text-indigo-700">{totalUsuarios}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center border border-slate-200">
            <p className="text-slate-600 text-sm">Usuarios activos</p>
            <p className="text-2xl font-bold text-green-600">{totalActivos}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 text-center border border-slate-200">
            <p className="text-slate-600 text-sm">Días monitoreados</p>
            <p className="text-2xl font-bold text-amber-600">6</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded-xl px-6 py-3 pr-10 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700 font-medium"
            >
              <option value="todos">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
              ▼
            </div>
          </div>
        </div>

        {/* Tarjetas por día - Diseño moderno */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((dia) => {
            const totalDia = Object.values(statsPorDia[dia]).reduce((a, b) => a + b, 0);
            return (
              <div
                key={dia}
                className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 hover:shadow-md transition"
              >
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 px-5">
                  <h3 className="font-bold text-lg text-center">Día {dia}</h3>
                </div>
                <div className="p-5 space-y-3">
                  {OPCIONES_ASISTENCIA.map((estado) => {
                    const count = statsPorDia[dia][estado] || 0;
                    const config = ESTADO_CONFIG[estado] || {
                      label: estado,
                      color: "bg-gray-400",
                      text: "text-gray-800",
                    };
                    return count > 0 ? (
                      <div key={estado} className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${config.color} text-white text-xs font-bold`}
                        >
                          {count}
                        </span>
                      </div>
                    ) : null;
                  })}
                  {totalDia === 0 && (
                    <p className="text-slate-500 text-sm text-center italic mt-2">Sin registros</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Indicador de carga (solo durante carga inicial) */}
        {loading && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-700 font-medium">Cargando datos...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
