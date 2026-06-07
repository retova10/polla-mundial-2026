import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { NotificationsRoot } from "./lib/notifications";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Mundial from "./pages/Mundial";
import Reglas from "./pages/Reglas";
import Admin from "./pages/Admin";
import AdminScores from "./pages/AdminScores";
import AdminPollas from "./pages/AdminPollas";
import AdminMatrix from "./pages/AdminMatrix";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationsRoot />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="mundial" element={<Mundial />} />
            <Route path="reglas" element={<Reglas />} />
            {/* Matriz: accesible a TODOS los jugadores; el componente redacta
                las celdas de partidos no finalizados para roles no-admin. */}
            <Route path="matrix" element={<AdminMatrix />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute requireRole="admin">
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/scores"
              element={
                <ProtectedRoute requireRole="admin">
                  <AdminScores />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/pollas"
              element={
                <ProtectedRoute requireRole="admin">
                  <AdminPollas />
                </ProtectedRoute>
              }
            />
            {/* Compat: ruta vieja redirige a /matrix */}
            <Route
              path="admin/matrix"
              element={<Navigate to="/matrix" replace />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
