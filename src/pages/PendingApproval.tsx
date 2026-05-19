import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function PendingApproval() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="card-elevated p-10 max-w-md text-center space-y-5 animate-slide-up">
        <div className="text-6xl">⏳</div>
        <h1 className="font-display font-bold text-3xl text-slate-900">
          Esperando aprobación
        </h1>
        <p className="text-slate-600 leading-relaxed">
          Hola{" "}
          <strong className="text-slate-900">
            {profile?.display_name ?? profile?.email}
          </strong>
          , tu cuenta está creada pero el administrador aún no la ha aprobado.
        </p>
        <p className="text-slate-500 text-sm">
          Cuando el admin te apruebe podrás iniciar sesión y enviar tus
          marcadores. Vuelve más tarde.
        </p>
        <button onClick={handleLogout} className="btn-secondary w-full">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
