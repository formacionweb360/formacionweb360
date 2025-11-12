import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorPage({ user, onLogout }) {
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
  const fechaHoy = new Date().toISOString().split("T")[0];

  useEffect(() => {
    cargarCampañas();
    cargarActivos();
  }, []);

  // 🔹 Cargar campañas
  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*");
    if (!error) setCampañas(data || []);
    else setCampañas([]);
  };

  // 🔹 Cargar grupos por campaña
  const cargarGrupos = async (campana_id) => {
    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .eq("campana_id", campana_id);
    if (!error) setGrupos(data || []);
    else setGrupos([]);
  };

  // 🔹 Cargar cursos por campaña y grupo
  const cargarCursos = async (campana_id, grupo_id) => {
    try {
      let query = supabase
        .from("cursos")
        .select("*")
        .eq("campana_id", campana_id)
        .eq("estado", "Activo");

      if (grupo_id) query = query.or(`grupo_id.is.null,grupo_id.eq.${grupo_id}`);

      const { data, error } = await query;
      if (!error) setCursos(data || []);
      else setCursos([]);
    } catch (err) {
      console.error("Error cargando cursos:", err);
      setCursos([]);
    }
  };

  // 🔹 Cargar cursos activos de hoy
  const cargarActivos = async () => {
    const { data, error } = await supabase
      .from("cursos_activados")
      .select(
        "id, curso_id, campana_id, grupo_id, fecha, activo, cursos(titulo), grupos(nombre)"
      )
      .eq("fecha", fechaHoy)
      .eq("formador_id", user.id);
    if (!error) setActivos(data || []);
    else setActivos([]);
  };

  // 🔹 Activar curso del día
  const activarCurso = async () => {
    const { campana_id, grupo_id, curso_id } = seleccion;
    if (!campana_id || !grupo_id || !curso_id)
      return setMensaje("⚠️ Selecciona campaña, grupo y curso");

    // Verificar si ya está activado hoy
    const { data: existe } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("fecha", fechaHoy)
      .eq("campana_id", campana_id)
      .eq("grupo_id", grupo_id)
      .eq("curso_id", curso_id)
      .maybeSingle();

    if (existe) {
      setMensaje("⚠️ Este curso ya está activado hoy.");
      return;
    }

    // Insertar activación del curso
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
      setMensaje("❌ Error al activar el curso");
      return;
    }

    // Asignar solo a los asesores activos del grupo
    const { data: asesores } = await supabase
      .from("usuarios")
      .select("id")
      .eq("rol", "Usuario")
      .eq("grupo_id", grupo_id)
      .eq("estado", "Activo");

    if (asesores?.length > 0) {
      await supabase.from("cursos_asesores").insert(
        asesores.map((u) => ({
          curso_activado_id: activacion.id,
          asesor_id: u.id,
        }))
      );
    }

    setMensaje("✅ Curso activado correctamente");
    cargarActivos();
  };

  // 🔹 Desactivar curso
  const desactivarCurso = async (id) => {
    const { error } = await supabase.from("cursos_activados").delete().eq("id", id);
    if (!error) {
      setMensaje("🗑 Curso desactivado");
      cargarActivos();
    } else {
      setMensaje("❌ Error al desactivar");
    }
  };

  // 🔹 Cerrar sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🔹 Menú superior */}
      <nav className="bg-indigo-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <h1 className="text-lg font-semibold">📘 Formación360 | Formador</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm">{user?.email || "Formador"}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* 🔹 Contenido principal */}
      <div className="p-6 md:p-10">
        <div className="bg-white rounded-2xl shadow p-6 mb-6 space-y-3 max-w-xl mx-auto">
          <h2 className="font-semibold text-base text-gray-700">Activar Curso</h2>

          {/* Selección de campaña */}
          <select
            className="w-full border rounded-lg p-2 text-sm"
            value={seleccion.campana_id}
            onChange={async (e) => {
              const campana_id = e.target.value;
              setSeleccion({ campana_id, grupo_id: "", curso_id: "" });
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

          {/* Selección de grupo */}
          <select
            className="w-full border rounded-lg p-2 text-sm"
            value={seleccion.grupo_id}
            onChange={async (e) => {
              const grupo_id = e.target.value;
              setSeleccion({ ...seleccion, grupo_id, curso_id: "" });
              await cargarCursos(seleccion.campana_id, grupo_id);
            }}
          >
            <option value="">Selecciona un grupo</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </select>

          {/* Malla de cursos */}
          {cursos.length > 0 && (
            <div className="bg-gray-100 p-3 rounded-lg mt-2 max-h-48 overflow-y-auto text-sm">
              <h3 className="font-semibold mb-2">Malla de cursos:</h3>
              <ul className="list-disc pl-5 text-gray-700">
                {cursos.map((c, index) => (
                  <li key={c.id}>
                    {index + 1}. {c.titulo} ({c.duracion_minutos} min)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Selección de curso */}
          <select
            className="w-full border rounded-lg p-2 text-sm mt-2"
            value={seleccion.curso_id}
            onChange={(e) =>
              setSeleccion({ ...seleccion, curso_id: e.target.value })
            }
          >
            <option value="">Selecciona un curso para activar</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>

          <button
            onClick={activarCurso}
            className="bg-indigo-600 text-white w-full py-2 rounded-lg hover:bg-indigo-700 text-sm"
          >
            Activar curso de hoy
          </button>

          <p className="text-xs text-gray-600">{mensaje}</p>
        </div>

        {/* 🔹 Cursos activos */}
        <div className="bg-white rounded-2xl shadow p-6 max-w-xl mx-auto">
          <h2 className="font-semibold text-base mb-3 text-gray-700">
            Cursos activos de hoy
          </h2>
          {activos.length === 0 && (
            <p className="text-gray-500 text-sm">Ninguno por ahora</p>
          )}
          {activos.map((a) => (
            <div
              key={a.id}
              className="flex justify-between items-center border-b py-2 text-sm"
            >
              <span>
                {a.cursos?.titulo || "Curso"} — {a.grupos?.nombre || "Grupo"}
              </span>
              <button
                onClick={() => desactivarCurso(a.id)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Desactivar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
