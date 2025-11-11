import { useState } from "react"
import LoginForm from "./components/LoginForm"
import AdminPage from "./pages/AdminPage"
import FormadorPage from "./pages/FormadorPage"
import UsuarioPage from "./pages/UsuarioPage"

export default function App() {
  const [user, setUser] = useState(null)

  if (!user) return <LoginForm onLogin={setUser} />

  switch (user.rol) {
    case "Administrador":
      return <AdminPage user={user} />
    case "Formador":
      return <FormadorPage user={user} />
    default:
      return <UsuarioPage user={user} />
  }
}
