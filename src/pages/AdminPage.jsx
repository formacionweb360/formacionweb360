import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { FunnelIcon } from "@heroicons/react/24/outline";

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
  "ASISTIÓ": { label: "Asistió", color: "bg-green-500" },
  "FALTA": { label: "Falta", color: "bg-red-500" },
  "TARDANZA": { label: "Tardanza", color: "bg-yellow-400" },
  "DESERTÓ": { label: "Desertó", color: "bg-purple-500" },
  "NO SE PRESENTÓ": { label: "No se presentó", color: "bg-gray-500" },
  "RETIRADO": { label: "Retirado", color: "bg-orange-500" },
  "NO APROBO ROLE PLAY": { label: "No aprobó RP", color: "bg-blue-500" }
};

export default function AdminPage({ user }) {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        const uniqueGroups = [...new Set(data.map(u => u.grupo_nombre).filter(Boolean))];
        setGrupos(uniqueGroups.sort());
      } catch (err) {
        console.error("Error al cargar datos:", err);
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
      stats[dia] = {};
      OPCIONES_ASISTENCIA.forEach(op => {
        stats[dia][op] = usuariosFiltrados.filter(u => u[key] === op).length;
      });
    });
    return stats;
  }, [usuariosFiltrados]);

  const totalActivos = usuariosFiltrados.filter(u => u.estado === "Activo").length;

  // Acceso denegado si no es administrador
  if (user?.rol !== "Administrador") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600">Acceso denegado</h1>
          <p className="text-gray-500 mt-2">No tienes permisos para acceder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard de Asistencia</h1>
        <p className="text-slate-500 mt-1">Visión general por día</p>
      </header>

      {/* CONTROLES */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
          <FunnelIcon className="w-5 h-5 text-slate-500" aria-hidden="true" />
          <select
            aria-label="Filtrar por grupo"
            className="outline-none text-sm text-slate-700 bg-transparent"
            value={filtroGrupo}
            onChange={(e) => setFiltroGrupo(e.target.value)}
          >
            <option value="todos">Todos los grupos</option>
            {grupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white px-6 py-3 rounded-lg shadow-sm text-sm whitespace-nowrap">
          <span className="font-semibold text-indigo-600">{usuariosFiltrados.length}</span>{" "}
          usuarios •{" "}
          <span className="font-semibold text-green-600">{totalActivos}</span> activos
        </div>
      </div>

      {/* GRID DIAS */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm animate-pulse h-64"
              >
                <div className="bg-slate-200 h-10 rounded-t-xl"></div>
                <div className="p-5 space-y-3">
                  {OPCIONES_ASISTENCIA.map((_, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                      <div className="h-6 w-8 bg-slate-200 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          : [1, 2, 3, 4, 5, 6].map((dia) => (
              <div
                key={dia}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition"
              >
                <div className="bg-indigo-600 text-white py-3 rounded-t-xl text-center font-semibold">
                  Día {dia}
                </div>
                <div className="p-5 space-y-3">
                  {OPCIONES_ASISTENCIA.map((estado) => {
                    const count = statsPorDia[dia][estado];
                    const config = ESTADO_CONFIG[estado];
                    return (
                      <div key={estado} className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">{config.label}</span>
                        <span
                          className={`text-xs text-white px-3 py-1 rounded-full ${config.color}`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
