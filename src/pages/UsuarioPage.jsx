export default function UsuarioPage({ user }) {
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold text-indigo-700">👋 Hola {user.nombre}</h1>
      <p className="text-gray-600 mt-2">Rol: {user.rol}</p>
    </div>
  )
}
