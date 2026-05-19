import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Entry, Profile } from "../types/database";
import { toast, confirmDialog, promptDialog } from "../lib/notifications";

interface EntryWithProfile extends Entry {
  profile: Profile | null;
  predictions_count: number;
}

function PlayerPicker({
  value,
  onChange,
  users,
}: {
  value: string;
  onChange: (id: string) => void;
  users: Profile[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node))
        setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = users.find((u) => u.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) =>
        `${u.display_name ?? ""} ${u.email}`.toLowerCase().includes(q)
      )
    : users;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`truncate ${
            selected ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {selected
            ? `${selected.display_name ?? selected.email} (${selected.email})`
            : "— Selecciona jugador —"}
        </span>
        <span className="text-slate-400 ml-2 flex-shrink-0">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lift max-h-72 overflow-hidden flex flex-col"
          role="listbox"
        >
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar jugador…"
              className="input py-1.5 px-3 text-sm"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-400 text-center">
                No se encontraron jugadores.
              </div>
            ) : (
              filtered.map((u) => {
                const isSel = u.id === value;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 ${
                      isSel ? "bg-brand-50" : ""
                    }`}
                    role="option"
                    aria-selected={isSel}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white font-bold text-xs flex-shrink-0">
                      {(u.display_name ?? u.email)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {u.display_name ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {u.email}
                      </div>
                    </div>
                    {isSel && (
                      <span className="text-brand-600 font-bold">✓</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPollas() {
  const [entries, setEntries] = useState<EntryWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");

  // Form para agregar nueva polla
  const [newPollaUserId, setNewPollaUserId] = useState("");
  const [newPollaName, setNewPollaName] = useState("");
  const [newPollaPaid, setNewPollaPaid] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    const [eRes, pRes, predRes] = await Promise.all([
      supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("predictions").select("entry_id"),
    ]);

    if (eRes.error || pRes.error) {
      setError(eRes.error?.message ?? pRes.error?.message ?? "Error");
      setLoading(false);
      return;
    }

    const profilesById = new Map<string, Profile>();
    (pRes.data ?? []).forEach((p) =>
      profilesById.set(p.id, p as Profile)
    );

    const countByEntry = new Map<string, number>();
    ((predRes.data ?? []) as { entry_id: string }[]).forEach((p) => {
      countByEntry.set(p.entry_id, (countByEntry.get(p.entry_id) ?? 0) + 1);
    });

    const enriched: EntryWithProfile[] = (eRes.data ?? []).map((e) => ({
      ...(e as Entry),
      profile: profilesById.get((e as Entry).user_id) ?? null,
      predictions_count: countByEntry.get((e as Entry).id) ?? 0,
    }));

    setEntries(enriched);
    setProfiles((pRes.data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const eligibleUsers = useMemo(
    () =>
      profiles
        .filter((p) => p.is_approved && p.role !== "admin")
        .sort((a, b) =>
          (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email)
        ),
    [profiles]
  );

  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filter === "paid" && !e.paid) return false;
      if (filter === "unpaid" && e.paid) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${e.profile?.display_name ?? ""} ${e.profile?.email ?? ""} ${e.name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newPollaUserId) return;
    setCreating(true);

    // Auto-numerar el nombre si no se provee
    let name = newPollaName.trim();
    if (!name) {
      const userEntries = entries.filter((x) => x.user_id === newPollaUserId);
      name = `Polla #${userEntries.length + 1}`;
    }

    const { error } = await supabase.from("entries").insert({
      user_id: newPollaUserId,
      name,
      paid: newPollaPaid,
    });
    setCreating(false);
    if (error) {
      toast.error(`Error al crear polla: ${error.message}`);
      return;
    }
    toast.success(`Polla "${name}" creada`);
    setNewPollaUserId("");
    setNewPollaName("");
    setNewPollaPaid(true);
    await load();
  }

  async function togglePaid(e: EntryWithProfile) {
    const { error } = await supabase
      .from("entries")
      .update({ paid: !e.paid })
      .eq("id", e.id);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success(
        e.paid
          ? `"${e.name}" marcada como sin pagar`
          : `"${e.name}" marcada como pagada`
      );
      load();
    }
  }

  async function deleteEntry(e: EntryWithProfile) {
    const ok = await confirmDialog({
      title: `Eliminar polla "${e.name}"`,
      message: `Se borrarán los ${e.predictions_count} pronóstico${
        e.predictions_count === 1 ? "" : "s"
      } de ${e.profile?.display_name ?? e.profile?.email ?? "este usuario"}. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar polla",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("entries").delete().eq("id", e.id);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    } else {
      toast.success(`Polla "${e.name}" eliminada`);
      load();
    }
  }

  async function renameEntry(e: EntryWithProfile) {
    const newName = await promptDialog({
      title: "Cambiar nombre de la polla",
      label: "Nuevo nombre",
      defaultValue: e.name,
      placeholder: "Mi polla",
      confirmText: "Guardar",
      validate: (v) =>
        v.length === 0
          ? "El nombre no puede estar vacío"
          : v.length > 60
          ? "Máximo 60 caracteres"
          : null,
    });
    if (newName === null || newName === e.name) return;
    const { error } = await supabase
      .from("entries")
      .update({ name: newName })
      .eq("id", e.id);
    if (error) {
      toast.error(`Error al renombrar: ${error.message}`);
    } else {
      toast.success(`Renombrada a "${newName}"`);
      load();
    }
  }

  const stats = useMemo(() => {
    const total = entries.length;
    const paid = entries.filter((e) => e.paid).length;
    const unpaid = total - paid;
    const uniqueUsers = new Set(entries.map((e) => e.user_id)).size;
    return { total, paid, unpaid, uniqueUsers };
  }, [entries]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
          Gestión de <span className="text-brand-600">pollas</span>
        </h1>
        <p className="text-slate-500 mt-1.5">
          Habilita pollas adicionales por jugador y gestiona los pagos.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Pollas en juego" value={String(stats.total)} icon="🎟️" />
        <Stat label="Pagadas" value={String(stats.paid)} icon="✅" />
        <Stat
          label="Sin pagar"
          value={String(stats.unpaid)}
          icon="💰"
          highlight={stats.unpaid > 0}
        />
        <Stat label="Jugadores únicos" value={String(stats.uniqueUsers)} icon="👥" />
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          Habilitar nueva polla
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Le agrega al jugador una polla extra (no crea otro usuario, solo otra
          tarjeta de pronósticos).
        </p>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="label">Jugador</label>
            <PlayerPicker
              value={newPollaUserId}
              onChange={setNewPollaUserId}
              users={eligibleUsers}
            />
          </div>
          <div>
            <label className="label">Nombre (opcional)</label>
            <input
              type="text"
              value={newPollaName}
              onChange={(ev) => setNewPollaName(ev.target.value)}
              className="input"
              placeholder='Ej: "Polla #2", "La oficial"'
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-2.5">
            <input
              type="checkbox"
              checked={newPollaPaid}
              onChange={(ev) => setNewPollaPaid(ev.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Marcar pagada
          </label>
          <button
            type="submit"
            disabled={creating || !newPollaUserId}
            className="btn-primary"
          >
            {creating ? "Creando…" : "Habilitar"}
          </button>
        </form>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Pollas habilitadas
          </h2>
          <span className="badge-slate">{visibleEntries.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="input py-1.5 px-3 text-sm w-48"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="all">Todas</option>
              <option value="paid">Pagadas</option>
              <option value="unpaid">Sin pagar</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-400 py-6 text-center">Cargando…</div>
        ) : error ? (
          <div className="text-rose-600">{error}</div>
        ) : visibleEntries.length === 0 ? (
          <div className="text-slate-400 py-10 text-center">
            No hay pollas que coincidan con el filtro.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-3 pr-4 font-semibold">Jugador</th>
                  <th className="py-3 pr-4 font-semibold">Polla</th>
                  <th className="py-3 pr-4 font-semibold text-center">Pronósticos</th>
                  <th className="py-3 pr-4 font-semibold">Pago</th>
                  <th className="py-3 pr-4 font-semibold">Creada</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white font-bold text-xs flex-shrink-0">
                          {(e.profile?.display_name ?? e.profile?.email ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {e.profile?.display_name ?? "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {e.profile?.email ?? "(usuario eliminado)"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {e.name}
                    </td>
                    <td className="py-3 pr-4 text-center text-slate-600 tabular-nums">
                      {e.predictions_count} <span className="text-slate-400">/ 88</span>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => togglePaid(e)}
                        className={
                          e.paid
                            ? "badge-brand cursor-pointer"
                            : "badge-rose cursor-pointer"
                        }
                        title={e.paid ? "Clic para revertir" : "Marcar como pagada"}
                      >
                        {e.paid ? "✓ Pagada" : "✗ Pendiente"}
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {new Date(e.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => renameEntry(e)}
                          className="btn-ghost text-xs py-1 px-2"
                          title="Renombrar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteEntry(e)}
                          className="btn-ghost text-xs py-1 px-2 text-rose-600 hover:bg-rose-50"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-4 ${
        highlight ? "bg-gold-50 border-gold-200" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </div>
        <div className="text-lg opacity-70">{icon}</div>
      </div>
      <div
        className={`mt-1.5 font-display font-extrabold text-2xl sm:text-3xl ${
          highlight ? "text-gold-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
