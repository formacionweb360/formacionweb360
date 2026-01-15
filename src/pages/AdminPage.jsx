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
  "ASISTIÓ": { label: "Asistió", color: "bg-green-500", text: "text-green-800" },
  "FALTA": { label: "Falta", color: "bg-red-500", text: "text-red-800" },
  "TARDANZA": { label: "Tardanza", color: "bg-yellow-500", text: "text-yellow-800" },
  "DESERTÓ": { label: "Desertó", color: "bg-purple-500", text: "text-purple-800" },
  "NO SE PRESENTÓ": { label: "No se presentó", color: "bg-gray-600", text: "text-gray-800" },
  "RETIRADO": { label: "Retirado", color: "bg-orange-500", text: "text-orange-800" },
  "NO APROBO ROLE PLAY": { label: "No aprobó RP", color: "bg-blue-500", text: "text-blue-800" },
};

export default function AdminPage({ user }) {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [loading, setLoading] = useState(true);

  // Evitar ejecución si user aún no está definido (común en auth con Vercel)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.rol !== "Administrador") {
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

  // Mientras se resuelve la identidad del usuario, no mostrar nada (evita flickering)
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Acceso denegado si no es administrador
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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-800">📊 Dashboard de Asistencia</h1>
          <p className="text-slate-600 mt-2">Resumen por día del curso</p>
        </div>

        {/* Controles */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="w-full sm:w-auto">
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700"
            >
              <option value="todos">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white px-5 py-2.5 rounded-lg shadow-sm text-sm font-medium text-slate-700 whitespace-nowrap">
            <span className="text-indigo-700 font-semibold">{usuariosFiltrados.length}</span> usuarios •{" "}
            <span className="text-green-600 font-semibold">{totalActivos}</span> activos
          </div>
        </div>

        {/* Skeletons durante carga */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse h-64">
                <div className="h-10 bg-indigo-500"></div>
                <div className="p-4 space-y-3">
                  {OPCIONES_ASISTENCIA.slice(0, 4).map((_, j) => (
                    <div key={j} className="flex justify-between items-center">
                      <div className="h-4 bg-slate-200 rounded w-20"></div>
                      <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Tarjetas reales */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((dia) => (
              <div
                key={dia}
                className="bg-white rounded-xl shadow-sm overflow-hidden transition hover:shadow-md"
              >
                <div className="bg-indigo-600 text-white py-2.5 text-center font-semibold">
                  Día {dia}
                </div>
                <div className="p-4 space-y-2.5">
                  {OPCIONES_ASISTENCIA.map((estado) => {
                    const count = statsPorDia[dia][estado] || 0;
                    const config = ESTADO_CONFIG[estado] || {
                      label: estado,
                      color: "bg-gray-400",
                      text: "text-gray-800",
                    };
                    return count > 0 ? (
                      <div key={estado} className="flex justify-between items-center">
                        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${config.color} text-white text-xs font-bold`}
                        >
                          {count}
                        </span>
                      </div>
                    ) : null;
                  })}
                  {Object.values(statsPorDia[dia]).every((v) => v === 0) && (
                    <p className="text-slate-500 text-sm text-center italic mt-2">
                      Sin registros
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
