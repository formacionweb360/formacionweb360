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
      const { data, error } = await supabase
        .from("cursos_activados")
        .select(`
          id,
          curso_id,
          fecha,
          grupo_id,
          cursos(titulo, descripcion, url_iframe),
          grupos(nombre)
        `)
        .eq("campana_id", user.campana_id)  // filtramos por campaña del asesor
        .eq("grupo_id", user.grupo_id)      // filtramos por grupo del asesor
        .eq("activo", true);                // solo cursos activos

      if (error) {
        console.error("Error cargando cursos:", error);
        setMensaje("❌ Error al cargar cursos");
        setCursos([]);
      } else {
        setCursos(data || []);
        setMensaje((data || []).length === 0 ? "No tienes cursos activos por ahora." : "");
      }
    } catch (err) {
      console.error("Excepción cargando cursos:", err);
      setMensaje("❌ Error al cargar cursos");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-indigo-700 mb-6">
        👋 Hola {user.nombre}
      </h1>
      <p className="text-gray-600 mb-6">
        Rol: {user.rol} | Grupo: {user.grupo_id || "No asignado"}
      </p>

      <div className="bg-white rounded-2xl shadow p-6 max-w-xl space-y-4">
        <h2 className="font-semibold text-lg mb-4">Cursos activos de tu grupo</h2>

        {mensaje && <p className="text-gray-500">{mensaje}</p>}

        {cursos.map((c) => (
          <div key={c.id} className="flex justify-between items-center border-b py-2">
            <div>
              <span className="font-medium">{c.cursos?.titulo || "Curso"}</span>
              <p className="text-sm text-gray-500">{c.cursos?.descripcion || ""}</p>
              <p className="text-xs text-gray-400">Grupo: {c.grupos?.nombre || "No asignado"}</p>
            </div>
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
