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

// Configuración de colores para cada estado
const ESTADO_CONFIG = {
  "ASISTIÓ": { label: "Asistió", color: "bg-green-500", text: "text-green-800" },
  "FALTA": { label: "Falta", color: "bg-red-500", text: "text-red-800" },
  "TARDANZA": { label: "Tardanza", color: "bg-yellow-500", text: "text-yellow-800" },
  "DESERTÓ": { label: "Desertó", color: "bg-purple-500", text: "text-purple-800" },
  "NO SE PRESENTÓ": { label: "No se presentó", color: "bg-gray-600", text: "text-gray-800" },
  "RETIRADO": { label: "Retirado", color: "bg-orange-500", text: "text-orange-800" },
  "NO APROBO ROLE PLAY": { label: "No aprobó RP", color: "bg-blue-500", text: "text-blue-800" },
};

export default function AdminPage({ user, onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.rol !== "Administrador") return;

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
      } finally {
        setLoading(false);
      }
    };

    fetchDotacion();
  }, [user]);

  // Filtrar usuarios por grupo
  const usuariosFiltrados = useMemo(() => {
    if (filtroGrupo === "todos") return usuarios;
    return usuarios.filter(u => u.grupo_nombre === filtroGrupo);
  }, [usuarios, filtroGrupo]);

  // Calcular estadísticas por día
  const statsPorDia = useMemo(() => {
    const dias = [1, 2, 3, 4, 5, 6];
    const stats = {};

    dias.forEach(dia => {
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

  // Total de usuarios activos
  const totalActivos = usuariosFiltrados.filter(u => u.estado === "Activo").length;

  if (user?.rol !== "Administrador") {
    return (
      <div className="p-10 text-center">
        <h1 className="text-3xl font-bold text-red-600">🚫 Acceso denegado</h1>
        <p className="text-gray-600 mt-2">Solo los administradores pueden ver este panel.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra superior con título y botón de logout */}
      <div className="flex justify-between items-center p-4 bg-white shadow-sm">
        <h1 className="text-xl font-bold text-indigo-700">📊 Dashboard de Asistencia</h1>
        <button
          onClick={onLogout}
          className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="p-6 max-w-[95vw] mx-auto">
        <div className="mb-8 text-center">
          <p className="text-gray-600 mt-2">Resumen general de asistencia por día</p>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex justify-center">
          <select
            value={filtroGrupo}
            onChange={(e) => setFiltroGrupo(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="todos">Todos los grupos</option>
            {grupos.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Resumen general */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-5 text-center">
          <p className="text-gray-700">
            <span className="font-semibold text-indigo-700">{usuariosFiltrados.length}</span> usuarios en total •{" "}
            <span className="font-semibold text-green-600">{totalActivos}</span> activos
          </p>
        </div>

        {/* Grillas por día */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(dia => (
            <div key={dia} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-indigo-600 text-white py-2 px-4 text-center">
                <h3 className="font-bold text-lg">Día {dia}</h3>
              </div>
              <div className="p-4 space-y-3">
                {OPCIONES_ASISTENCIA.map(estado => {
                  const count = statsPorDia[dia][estado] || 0;
                  const config = ESTADO_CONFIG[estado] || { label: estado, color: "bg-gray-400", text: "text-gray-800" };
                  return count > 0 ? (
                    <div key={estado} className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${config.color} text-white text-xs font-bold`}>
                        {count}
                      </span>
                    </div>
                  ) : null;
                })}
                {Object.values(statsPorDia[dia]).every(v => v === 0) && (
                  <p className="text-gray-500 text-sm text-center italic">Sin registros</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Indicador de carga */}
        {loading && (
          <div className="text-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-2">Cargando datos...</p>
          </div>
        )}
      </div>
    </div>
  );
}
