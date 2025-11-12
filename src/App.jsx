import { useState } from "react";
import LoginForm from "./components/LoginForm";
import AdminPage from "./pages/AdminPage";
import FormadorPage from "./pages/FormadorPage";
import AsesorDashboard from "./pages/AsesorDashboard";
import CursoViewPage from "./pages/CursoViewPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [vista, setVista] = useState({ tipo: "dashboard", data: null });

  // Si no hay usuario, mostrar login
  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  // Función para navegar entre vistas
  const navegarACurso = (cursoId) => {
    setVista({ tipo: "curso", data: cursoId });
  };

  const volverADashboard = () => {
    setVista({ tipo: "dashboard", data: null });
  };

  // Mostrar vista de curso si está activa
  if (vista.tipo === "curso" && vista.data && user.rol === "Usuario") {
    return (
      <CursoViewPage 
        user={user} 
        cursoId={vista.data}
        onVolver={volverADashboard}
      />
    );
  }

  // Mostrar página según rol
  switch (user.rol) {
    case "Administrador":
      return <AdminPage user={user} />;
    case "Formador":
      return <FormadorPage user={user} />;
    default:
      return <AsesorDashboard user={user} onVerCurso={navegarACurso} />;
  }
}
