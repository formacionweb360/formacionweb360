export default function AdminPage({ user }) {
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold text-indigo-700">👋 Bienvenido {user.nombre}</h1>
      <p className="text-gray-600 mt-2">Rol: {user.rol}</p>
      <p className="mt-4">Aquí puedes agregar componentes administrativos.</p>
    </div>
  )
}
