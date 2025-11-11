import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorPage({ user }) {
  const [cursos, setCursos] = useState([]);
  const [campañas, setCampañas] = useState([]);
  const [seleccion, setSeleccion] = useState({ campaña_id: "", curso_id: "" });
  const [activos, setActivos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const fechaHoy = new Date().toISOString().split("T")[0];

  // Cargar datos al entrar
  useEffect(() => {
    cargarCursos();
    cargarCampañas();
    cargarActivos();
  }, []);

  const cargarCursos = async () => {
    // Traemos todos los cursos (o solo activos si quieres)
    const { data, error } = await supabase
      .from("cursos")
      .select("*")
      .eq("estado", "Activo"); // quita este .eq si quieres ver todos
    console.log("cargarCursos -> data:", data, "error:", error);
    if (!error) setCursos(data || []);
    else setCursos([]);
  };

  const cargarCampañas = async () => {
    const { data, error } = await supabase.from("campañas").select("*");
    console.log("cargarCampañas -> data:", data, "error:", error);
    if (!error) setCampañas(data || []);
    else setCampañas([]);
  };

  const cargarActivos = async () => {
    // Traemos las activaciones del día y además el título del curso y el nombre de campaña
    const { data, error } = await supabase
      .from("cursos_activados")
      .select("id, curso_id, campaña_id, fecha, activo, cursos(titulo), campañas(nombre)")
      .eq("fecha", fechaHoy)
      .eq("formador_id", user.id);
    console.log("cargarActivos -> data:", data, "error:", error);
    if (!error) setActivos(data || []);
    else setActivos([]);
  };

  const activarCurso = async () => {
    const { campaña_id, curso_id } = seleccion;
    if (!campaña_id || !curso_id) return setMensaje("⚠️ Selecciona campaña y curso");

    // Verificar si ya existe activación
    const { data: existe, error: errExiste } = await supabase
      .from("cursos_activados")
      .select("*")
      .eq("fecha", fechaHoy)
      .eq("campaña_id", campaña_id)
      .eq("curso_id", curso_id)
      .maybeSingle();

    console.log("existe?", existe, "err:", errExiste);
    if (errExiste) {
      setMensaje("❌ Error comprobando existencia: " + errExiste.message);
      return;
    }
    if (existe) {
      setMensaje("⚠️ Este curso ya está activado hoy para esa campaña.");
      return;
    }

    const { error } = await supabase.from("cursos_activados").insert([
      {
        campaña_id,
        curso_id,
        fecha: fechaHoy,
        activo: true,
        formador_id: user.id,
      },
    ]);

    if (error) {
      console.error("Error insert:", error);
      setMensaje("❌ Error al activar");
    } else {
      setMensaje("✅ Curso activado correctamente");
      cargarActivos();
    }
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
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">Panel del Formador</h1>

      <div className="bg-white rounded-2xl shadow p-6 mb-6 space-y-4 max-w-xl">
        <h2 className="font-semibold text-lg">Activar Curso</h2>

        <select
          className="w-full border rounded-lg p-2"
          value={seleccion.campaña_id}
          onChange={(e) => setSeleccion({ ...seleccion, campaña_id: e.target.value })}
        >
          <option value="">Selecciona una campaña</option>
          {campañas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          className="w-full border rounded-lg p-2"
          value={seleccion.curso_id}
          onChange={(e) => setSeleccion({ ...seleccion, curso_id: e.target.value })}
        >
          <option value="">Selecciona un curso</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo} ({c.estado})
            </option>
          ))}
        </select>

        <button
          onClick={activarCurso}
          className="bg-indigo-600 text-white w-full py-2 rounded-lg hover:bg-indigo-700"
        >
          Activar curso de hoy
        </button>

        <p className="text-sm text-gray-600">{mensaje}</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 max-w-xl">
        <h2 className="font-semibold text-lg mb-4">Cursos activos de hoy</h2>
        {activos.length === 0 && <p className="text-gray-500">Ninguno por ahora</p>}
        {activos.map((a) => (
          <div key={a.id} className="flex justify-between items-center border-b py-2">
            <span>{a.cursos?.titulo || "Curso"}</span>
            <button onClick={() => desactivarCurso(a.id)} className="text-red-500 hover:text-red-700">
              Desactivar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
