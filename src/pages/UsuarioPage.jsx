import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function UsuarioPage({ user }) {
  const [cursos, setCursos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    try {
      // Traer cursos activados para la campaña del asesor
      const { data, error } = await supabase
        .from("cursos_activados")
        .select(`
          id,
          curso_id,
          fecha,
          cursos(titulo, descripcion, url_iframe)
        `)
.eq("campana_id", user.campana_id)
.eq("activo", true)


      if (error) {
        console.error("Error cargando cursos:", error);
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
      <h1 className="text-2xl font-bold mb-6">👋 Hola {user.nombre}</h1>
      <p className="text-gray-600 mb-6">Rol: {user.rol}</p>

      <div className="bg-white rounded-2xl shadow p-6 max-w-xl space-y-4">
        <h2 className="font-semibold text-lg mb-4">Cursos activos de tu campaña</h2>

        {mensaje && <p className="text-gray-500">{mensaje}</p>}

        {cursos.map((c) => (
          <div
            key={c.id}
            className="flex justify-between items-center border-b py-2"
          >
            <span>{c.cursos?.titulo || "Curso"}</span>
            <span className="text-sm text-gray-400">
              {new Date(c.fecha).toLocaleDateString()}
            </span>
            <a
              href={`/curso/${c.id}`}
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
