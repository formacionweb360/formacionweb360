import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function FormadorUsuariosPage({ user, onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    if (user?.rol === "Formador") {
      cargarUsuariosPorCampana();
    }
  }, [user]);

  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje({ tipo: "", texto: "" }), 4000);
  };

  const cargarUsuariosPorCampana = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, usuario, estado, grupo_id")
        .eq("campana_id", user.campana_id) // Filtrar por campaña del formador
        .neq("rol", "Formador"); // Excluir otros formadores

      if (error) {
        console.error("Error al cargar usuarios:", error);
        mostrarMensaje("error", "Error al cargar usuarios.");
      } else {
        setUsuarios(data || []);
      }
    } catch (err) {
      console.error("Error general:", err);
      mostrarMensaje("error", "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstadoUsuario = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ estado: nuevoEstado })
      .eq("id", id);

    if (error) {
      console.error("Error al actualizar estado:", error);
      mostrarMensaje("error", "No se pudo actualizar el estado.");
    } else {
      setUsuarios(prev =>
        prev.map(u => u.id === id ? { ...u, estado: nuevoEstado } : u)
      );
      mostrarMensaje("success", `Usuario ${nuevoEstado.toLowerCase()}.`);
    }
  };

  const toggleEstado = (usuario) => {
    const nuevoEstado = usuario.estado === "Activo" ? "Inactivo" : "Activo";
    cambiarEstadoUsuario(usuario.id, nuevoEstado);
  };

  if (user?.rol !== "Formador") {
    return <div>Acceso denegado. Solo para formadores.</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <button
          onClick={onLogout}
          className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        >
          Cerrar sesión
        </button>
      </div>

      {mensaje.texto && (
        <div className={`mb-4 p-3 rounded-lg text-center ${mensaje.tipo === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {mensaje.texto}
        </div>
      )}

      {loading ? (
        <div className="text-center">Cargando usuarios...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{u.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{u.usuario}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{u.grupo_id || "Sin grupo"}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.estado === "Activo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {u.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleEstado(u)}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${u.estado === "Activo" ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                    >
                      {u.estado === "Activo" ? "Inactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
