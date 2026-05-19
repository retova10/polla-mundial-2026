import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { Profile, Role } from "../types/database";
import { toast, confirmDialog } from "../lib/notifications";

export default function Admin() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setUsers((data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreated(null);
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: email.trim(),
        password,
        display_name: displayName.trim(),
        phone: phone.trim() || null,
        role,
      },
    });
    setSubmitting(false);
    if (error) {
      const msg = (data as { error?: string })?.error ?? error.message;
      setCreateError(
        msg.includes("Function not found") || msg.includes("404")
          ? "La Edge Function 'create-user' no está desplegada. Crea el usuario desde Supabase Dashboard → Authentication → Users."
          : msg
      );
      return;
    }
    setCreated(`${email} creado y aprobado.`);
    setEmail("");
    setPassword("");
    setDisplayName("");
    setPhone("");
    setRole("player");
    await loadUsers();
  }

  async function approveUser(u: Profile) {
    // Aprobar = confirmar que ya pagó. Además de is_approved, marcamos como
    // pagadas todas las entries que el usuario ya tenga creadas para que el
    // ranking las muestre y pueda ingresar marcadores sin pasos extra.
    const [profileRes, entriesRes] = await Promise.all([
      supabase.from("profiles").update({ is_approved: true }).eq("id", u.id),
      supabase.from("entries").update({ paid: true }).eq("user_id", u.id),
    ]);
    const err = profileRes.error ?? entriesRes.error;
    if (err) {
      toast.error(`Error al aprobar: ${err.message}`);
    } else {
      toast.success(`${u.display_name ?? u.email} aprobado`);
      loadUsers();
    }
  }

  async function revokeUser(u: Profile) {
    const ok = await confirmDialog({
      title: "Revocar acceso",
      message: `${u.display_name ?? u.email} dejará de poder ingresar marcadores hasta que lo apruebes de nuevo.`,
      confirmText: "Revocar acceso",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: false })
      .eq("id", u.id);
    if (error) {
      toast.error(`Error al revocar: ${error.message}`);
    } else {
      toast.success(`Acceso revocado a ${u.display_name ?? u.email}`);
      loadUsers();
    }
  }

  async function toggleRole(u: Profile) {
    const newRole: Role = u.role === "admin" ? "player" : "admin";
    const ok = await confirmDialog({
      title: `Cambiar rol a ${newRole}`,
      message: `${u.display_name ?? u.email} pasará de "${u.role}" a "${newRole}".`,
      confirmText: `Cambiar a ${newRole}`,
      danger: newRole === "admin",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", u.id);
    if (error) {
      toast.error(`Error al cambiar rol: ${error.message}`);
    } else {
      toast.success(`${u.display_name ?? u.email} ahora es ${newRole}`);
      loadUsers();
    }
  }

  const pending = useMemo(
    () => users.filter((u) => !u.is_approved && u.role !== "admin"),
    [users]
  );
  const approved = useMemo(
    () => users.filter((u) => u.is_approved || u.role === "admin"),
    [users]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
          Panel de <span className="text-gold-600">administración</span>
        </h1>
        <p className="text-slate-500 mt-1.5">
          Aprueba inscripciones y gestiona los participantes de la polla.
        </p>
      </header>

      <section
        className={`card-elevated p-6 ${
          pending.length > 0
            ? "border-gold-200 ring-2 ring-gold-100"
            : ""
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Pendientes de aprobación
          </h2>
          <span className={pending.length > 0 ? "badge-gold" : "badge-slate"}>
            {pending.length}
          </span>
          {pending.length > 0 && (
            <span className="ml-auto text-xs text-gold-700 font-semibold">
              ⚠️ Requieren tu acción
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <div className="text-3xl mb-1.5">✅</div>
            <p className="text-sm">No hay usuarios pendientes de aprobación.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 grid place-items-center text-white font-bold text-sm flex-shrink-0">
                  {(u.display_name ?? u.email)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {u.display_name ?? u.email}
                    {u.whatsapp_group_optin && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                        title="Quiere unirse al grupo de WhatsApp"
                      >
                        💬 WhatsApp
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  {u.phone && (
                    <div className="text-xs text-slate-500">📱 {u.phone}</div>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(u.created_at).toLocaleDateString("es-CO")}
                </div>
                <button
                  onClick={() => approveUser(u)}
                  className="btn-primary text-sm py-1.5 px-3"
                >
                  ✓ Aprobar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          Crear usuario directamente
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Los usuarios creados aquí quedan aprobados automáticamente.
        </p>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="usuario@correo.com"
            />
          </div>
          <div>
            <label className="label">Nombre</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="label">Celular</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+57 300 000 0000"
            />
          </div>
          <div>
            <label className="label">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="input"
            >
              <option value="player">Jugador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Contraseña inicial (mín. 8)</label>
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Comparte esta contraseña con el usuario"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Creando…" : "Crear usuario"}
            </button>
            {created && (
              <span className="text-sm text-brand-600 font-semibold">
                ✓ {created}
              </span>
            )}
            {createError && (
              <span className="text-sm text-rose-600">{createError}</span>
            )}
          </div>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Usuarios{" "}
          <span className="text-slate-400 font-normal">({approved.length})</span>
        </h2>
        {loading ? (
          <div className="text-slate-400 py-6 text-center">Cargando…</div>
        ) : error ? (
          <div className="text-rose-600">{error}</div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-3 pr-4 font-semibold">Usuario</th>
                  <th className="py-3 pr-4 font-semibold">Celular</th>
                  <th className="py-3 pr-4 font-semibold">Rol</th>
                  <th className="py-3 pr-4 font-semibold">Estado</th>
                  <th className="py-3 pr-4 font-semibold">Creado</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {approved.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white font-bold text-xs flex-shrink-0">
                          {(u.display_name ?? u.email)[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            {u.display_name ?? "—"}
                            {u.whatsapp_group_optin && (
                              <span
                                className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                                title="Quiere unirse al grupo de WhatsApp"
                              >
                                💬 WhatsApp
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {u.phone ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={u.role === "admin" ? "badge-gold" : "badge-brand"}
                      >
                        {u.role === "admin" ? "Admin" : "Jugador"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {u.is_approved ? (
                        <span className="badge-brand">Activo</span>
                      ) : (
                        <span className="badge-slate">Inactivo</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {u.role !== "admin" && u.is_approved && (
                          <button
                            onClick={() => revokeUser(u)}
                            className="btn-ghost text-xs py-1 px-2"
                          >
                            Revocar
                          </button>
                        )}
                        <button
                          onClick={() => toggleRole(u)}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {approved.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No hay usuarios todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
