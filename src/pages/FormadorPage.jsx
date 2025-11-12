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
    if (!campana_id || !grupo_id || !curso_id)
      return setMensaje("⚠️ Selecciona campaña, grupo y curso");

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
    cargarActivos();
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

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.href = "/"; // Redirige al inicio
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Panel del Formador</h1>
        <button
          onClick={cerrarSesion}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center gap-2"
        >
          Cerrar sesión
        </button>
      </header>

      {/* Activar curso */}
      <section className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block font-semibold mb-1">Campaña</label>
          <select
            className="w-full border rounded-lg p-2"
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
          <label className="block font-semibold mb-1">Grupo</label>
          <select
            className="w-full border rounded-lg p-2"
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
        </div>

        <div>
          <label className="block font-semibold mb-1">Curso</label>
          <select
            className="w-full border rounded-lg p-2"
            value={seleccion.curso_id}
            onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
          >
            <option value="">Selecciona un curso a activar</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo} ({c.estado})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Malla de cursos */}
      {cursos.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {cursos.map((c, index) => (
            <div key={c.id} className="bg-indigo-50 p-4 rounded-lg shadow flex flex-col justify-between">
              <h3 className="font-semibold text-indigo-700">{index + 1}. {c.titulo}</h3>
              <p className="text-gray-600 text-sm">{c.duracion_minutos} min</p>
            </div>
          ))}
        </section>
      )}

      {/* Botón activar */}
      <div className="max-w-xl mb-6">
        <button
          onClick={activarCurso}
          className="bg-indigo-600 text-white w-full py-2 rounded-lg hover:bg-indigo-700"
        >
          Activar curso de hoy
        </button>
        <p className="text-sm text-gray-600 mt-2">{mensaje}</p>
      </div>

      {/* Cursos activos */}
      <section className="bg-white rounded-2xl shadow p-6 max-w-xl">
        <h2 className="font-semibold text-lg mb-4">Cursos activos de hoy</h2>
        {activos.length === 0 && <p className="text-gray-500">Ninguno por ahora</p>}
        <div className="space-y-3">
          {activos.map((a) => (
            <div key={a.id} className="flex justify-between items-center border-b py-2">
              <span>
                {a.cursos?.titulo || "Curso"} — <span className="font-semibold">{a.grupos?.nombre || "Grupo"}</span>
              </span>
              <button
                onClick={() => desactivarCurso(a.id)}
                className="bg-red-100 text-red-500 px-3 py-1 rounded hover:bg-red-200"
              >
                Desactivar
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
