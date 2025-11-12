import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import AdminPage from "./pages/AdminPage";
import FormadorPage from "./pages/FormadorPage";
import AsesorDashboard from "./pages/AsesorDashboard";
import CursoViewPage from "./pages/CursoViewPage";

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <Router>
      <Routes>
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

        <Route 
          path="/admin" 
          element={
            user.rol === "Administrador" ? (
              <AdminPage user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        <Route 
          path="/formador" 
          element={
            user.rol === "Formador" ? (
              <FormadorPage user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        <Route 
          path="/dashboard" 
          element={
            user.rol === "Usuario" ? (
              <AsesorDashboard user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        <Route 
          path="/curso/:id" 
          element={
            user.rol === "Usuario" ? (
              <CursoViewPage user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
