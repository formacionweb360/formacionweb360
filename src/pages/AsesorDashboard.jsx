import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AsesorDashboard({ user }) {
  const [cursos, setCursos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    try {
      const { data, error } = await supabase
        .from("cursos_asesores")
        .select(`
          curso_activado_id,
          cursos_activados(id, curso_id, fecha, activo, cursos(titulo))
        `)
        .eq("asesor_id", user.id)
        .eq("cursos_activados.activo", true);

      if (error) {
        console.error("Error cargando cursos del asesor:", error);
        setMensaje("❌ Error al cargar cursos");
        setCursos([]);
      } else {
        setCursos(data || []);
        if ((data || []).length === 0) setMensaje("No tienes cursos activos por ahora.");
        else setMensaje("");
      }
    } catch (err) {
      console.error("Excepción cargando cursos:", err);
      setMensaje("❌ Error al cargar cursos");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard del Asesor</h1>

      <div className="bg-white rounded-2xl shadow p-6 max-w-xl space-y-4">
        <h2 className="font-semibold text-lg mb-4">Cursos activos asignados</h2>

        {mensaje && <p className="text-gray-500">{mensaje}</p>}

        {cursos.map((c) => (
          <div
            key={c.curso_activado_id}
            className="flex justify-between items-center border-b py-2"
          >
            <span>{c.cursos_activados.cursos?.titulo || "Curso"}</span>
            <span className="text-sm text-gray-400">
              {new Date(c.cursos_activados.fecha).toLocaleDateString()}
            </span>
            <a
              href={`/curso/${c.cursos_activados.id}`}
              className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
            >
              Ver
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
