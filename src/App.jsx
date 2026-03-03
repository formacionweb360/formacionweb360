// src/App.jsx
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// ✅ Componentes
import LoginForm from "./components/LoginForm";
import AdminPage from "./pages/AdminPage";
import FormadorPage from "./pages/FormadorPage";
//import FormadorAsistencia from "./pages/FormadorAsistencia"; //
import AsesorDashboard from "./pages/AsesorDashboard";
import CursoViewPage from "./pages/CursoViewPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar usuario del localStorage al iniciar
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  // Guardar usuario en localStorage cuando cambie
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  // Función para cerrar sesión con redirección a raíz
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  // Mostrar loading mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, mostrar login
  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Routes>
        {/* Ruta raíz - redirige según el rol */}
        <Route
          path="/"
          element={
            user.rol === "Administrador" ? (
              <Navigate to="/admin" replace />
            ) : user.rol === "Formador" ? (
              <Navigate to="/formador" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* ===== RUTAS DE ADMINISTRADOR ===== */}
        <Route
          path="/admin"
          element={
            user.rol === "Administrador" ? (
              <AdminPage user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* ===== RUTAS DE FORMADOR ===== */}
        
        {/* Panel principal del formador (activar cursos, malla, QR) */}
        <Route
          path="/formador"
          element={
            user.rol === "Formador" ? (
              <FormadorPage user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* ✅ Gestión de asistencia (tabla formacion_seguimiento) */}
        <Route
          path="/formador/asistencia"
          element={
            user.rol === "Formador" ? (
              <FormadorAsistencia user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* ===== RUTAS DE ASESOR/USUARIO ===== */}
        
        {/* Dashboard del asesor */}
        <Route
          path="/dashboard"
          element={
            user.rol === "usuario" ? (
              <AsesorDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Vista de curso individual */}
        <Route
          path="/curso/:id"
          element={
            user.rol === "usuario" ? (
              <CursoViewPage user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Ruta 404 - cualquier otra ruta */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
