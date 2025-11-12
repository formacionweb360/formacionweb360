import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorPage({ user }) {
  const [campañas, setCampañas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [seleccion, setSeleccion] = useState({
    campana_id: "",
    grupo_id: "",
    curso_id: "",
  });
  const [activos, setActivos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const fechaHoy = new Date().toISOString().split("T")[0];

  useEffect(() => {
    cargarCampañas();
    cargarActivos();
  }, []);

  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*");
    if (!error) setCampañas(data || []);
    else setCampañas([]);
  };

  const cargarGrupos = async (campana_id) => {
    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .eq("campana_id", campana_id);
    if (!error) setGrupos(data || []);
    else setGrupos([]);
  };

  const cargarCursos = async (campana_id, grupo_id) => {
    try {
      let query = supabase
        .from("cursos")
        .select("*")
        .eq("campana_id", campana_id)
        .eq("estado", "Activo");

      if (grupo_id) {
        query = query.or(`grupo_id.is.null,grupo_id.eq.${grupo_id}`);
      }

      const { data, error } = await query;
      if (!error) setCursos(data || []);
      else setCursos([]);
    } catch (err) {
      console.error("Error cargando cursos:", err);
      setCursos([]);
    }
  };

  const cargarActivos = async () => {
    const { data, error } = await supabase
      .from("cursos_activados")
      .select("id, curso_id, campana_id, grupo_id, fecha, activo, cursos(titulo), grupos(nombre)")
      .eq("fecha", fechaHoy)
      .eq("formador_id", user.id);
    if (!error) setActivos(data || []);
    else setActivos([]);
  };

  const activarCurso = async () => {
    const { campana_id, grupo_id, curso_id } = seleccion;
    if (!campana_id || !grupo_id || !curso_id) {
      setMensaje("⚠️ Selecciona campaña, grupo y curso");
      return;
    }

    setLoading(true);
    setMensaje("");

    const { data: existe } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("fecha", fechaHoy)
      .eq("campana_id", campana_id)
      .eq("grupo_id", grupo_id)
      .eq("curso_id", curso_id)
      .maybeSingle();

    if (existe) {
      setMensaje("⚠️ Este curso ya está activado hoy para esa campaña y grupo.");
      setLoading(false);
      return;
    }

    const { data: activacion, error } = await supabase
      .from("cursos_activados")
      .insert([
        {
          campana_id,
          grupo_id,
          curso_id,
          fecha: fechaHoy,
          activo: true,
          formador_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      setMensaje("❌ Error al activar");
      setLoading(false);
      return;
    }

    const { data: asesores, error: errAsesores } = await supabase
      .from("usuarios")
      .select("id")
      .eq("rol", "Usuario")
      .eq("grupo_id", grupo_id)
      .eq("estado", "Activo");

    if (!errAsesores && asesores.length > 0) {
      await supabase.from("cursos_asesores").insert(
        asesores.map((u) => ({
          curso_activado_id: activacion.id,
          asesor_id: u.id,
        }))
      );
    }

    setMensaje("✅ Curso activado correctamente");
    setSeleccion({ campana_id, grupo_id, curso_id: "" }); // Reiniciar solo el curso
    cargarActivos();
    setLoading(false);
  };

  const desactivarCurso = async (id) => {
    const { error } = await supabase.from("cursos_activados").delete().eq("id", id);
    if (!error) {
      setMensaje("🗑 Curso desactivado");
      cargarActivos();
    } else {
      setMensaje("❌ Error al desactivar");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Panel del Formador</h1>
          <p className="text-gray-600 mt-2">Gestiona cursos para hoy</p>
        </header>

        {/* Sección Activar Curso */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
          <h2 className="font-bold text-xl text-gray-800 mb-4">Activar Nuevo Curso</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">Campaña</label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                value={seleccion.campana_id}
                onChange={async (e) => {
                  const campana_id = e.target.value;
                  setSeleccion({ ...seleccion, campana_id, grupo_id: "", curso_id: "" });
                  await cargarGrupos(campana_id);
                  setCursos([]);
                }}
              >
                <option value="">Selecciona una campaña</option>
                {campañas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">Grupo</label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                value={seleccion.grupo_id}
                onChange={async (e) => {
                  const grupo_id = e.target.value;
                  setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
                  await cargarCursos(seleccion.campana_id, grupo_id);
                }}
                disabled={!seleccion.campana_id}
              >
                <option value="">Selecciona un grupo</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>

            {cursos.length > 0 && (
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <h3 className="font-semibold text-indigo-800 mb-2">Malla de Cursos Disponibles</h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {cursos.map((c, index) => (
                    <li key={c.id} className="text-sm">
                      {index + 1}. <span className="font-medium">{c.titulo}</span> — {c.duracion_minutos} min
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">Curso a Activar</label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                value={seleccion.curso_id}
                onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
                disabled={!cursos.length}
              >
                <option value="">Selecciona un curso</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo} ({c.estado})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={activarCurso}
              disabled={loading || !seleccion.curso_id}
              className={`w-full py-3 rounded-xl font-medium transition ${
                loading || !seleccion.curso_id
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800"
              }`}
            >
              {loading ? "Procesando..." : "Activar Curso de Hoy"}
            </button>

            {mensaje && (
              <div className={`text-center p-3 rounded-lg ${mensaje.startsWith("✅") ? "bg-green-100 text-green-800" : mensaje.startsWith("⚠️") ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                {mensaje}
              </div>
            )}
          </div>
        </div>

        {/* Cursos Activos */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <h2 className="font-bold text-xl text-gray-800 mb-4">Cursos Activos de Hoy</h2>
          {activos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Ningún curso activo por ahora</p>
          ) : (
            <div className="space-y-3">
              {activos.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div>
                    <p className="font-medium text-gray-800">{a.cursos?.titulo || "Curso sin título"}</p>
                    <p className="text-sm text-gray-600">{a.grupos?.nombre || "Grupo sin nombre"}</p>
                  </div>
                  <button
                    onClick={() => desactivarCurso(a.id)}
                    className="text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition"
                  >
                    Desactivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
