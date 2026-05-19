// Sistema de notificaciones in-house: toast (info/success/error),
// confirmDialog (sí/no), promptDialog (input texto). Sin dependencias.
//
// Uso desde cualquier componente o función:
//   import { toast, confirmDialog, promptDialog } from "../lib/notifications";
//   toast.success("Guardado");
//   if (await confirmDialog({ title: "Borrar?", danger: true })) { ... }
//   const nombre = await promptDialog({ title: "Nuevo nombre", defaultValue: "X" });
//
// Requisito: <NotificationsRoot /> montado UNA VEZ en App.tsx.

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// ============================================================
// TOAST
// ============================================================
type ToastKind = "info" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
let nextToastId = 1;

function emitToasts() {
  toastListeners.forEach((cb) => cb());
}
function subscribeToasts(cb: () => void) {
  toastListeners.add(cb);
  return () => toastListeners.delete(cb);
}
function getToastSnapshot() {
  return toasts;
}

const TOAST_TTL_MS = 4500;

function pushToast(kind: ToastKind, message: string) {
  const t: Toast = { id: nextToastId++, kind, message };
  toasts = [...toasts, t];
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emitToasts();
  }, TOAST_TTL_MS);
}

function dismissToast(id: number) {
  toasts = toasts.filter((x) => x.id !== id);
  emitToasts();
}

export const toast = {
  show: (msg: string) => pushToast("info", msg),
  info: (msg: string) => pushToast("info", msg),
  success: (msg: string) => pushToast("success", msg),
  error: (msg: string) => pushToast("error", msg),
};

// ============================================================
// CONFIRM
// ============================================================
interface ConfirmOpts {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Botón de confirmar en rojo, para acciones destructivas. */
  danger?: boolean;
}
interface ConfirmReq extends ConfirmOpts {
  id: number;
  resolve: (ok: boolean) => void;
}

let confirms: ConfirmReq[] = [];
const confirmListeners = new Set<() => void>();
let nextConfirmId = 1;

function emitConfirms() {
  confirmListeners.forEach((cb) => cb());
}
function subscribeConfirms(cb: () => void) {
  confirmListeners.add(cb);
  return () => confirmListeners.delete(cb);
}
function getConfirmSnapshot() {
  return confirms;
}

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirms = [
      ...confirms,
      { ...opts, id: nextConfirmId++, resolve },
    ];
    emitConfirms();
  });
}

function resolveConfirm(id: number, ok: boolean) {
  const c = confirms.find((x) => x.id === id);
  if (!c) return;
  c.resolve(ok);
  confirms = confirms.filter((x) => x.id !== id);
  emitConfirms();
}

// ============================================================
// PROMPT
// ============================================================
interface PromptOpts {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  /** Validación opcional: retornar string con mensaje de error para bloquear. */
  validate?: (value: string) => string | null;
}
interface PromptReq extends PromptOpts {
  id: number;
  resolve: (value: string | null) => void;
}

let prompts: PromptReq[] = [];
const promptListeners = new Set<() => void>();
let nextPromptId = 1;

function emitPrompts() {
  promptListeners.forEach((cb) => cb());
}
function subscribePrompts(cb: () => void) {
  promptListeners.add(cb);
  return () => promptListeners.delete(cb);
}
function getPromptSnapshot() {
  return prompts;
}

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    prompts = [
      ...prompts,
      { ...opts, id: nextPromptId++, resolve },
    ];
    emitPrompts();
  });
}

function resolvePrompt(id: number, value: string | null) {
  const p = prompts.find((x) => x.id === id);
  if (!p) return;
  p.resolve(value);
  prompts = prompts.filter((x) => x.id !== id);
  emitPrompts();
}

// ============================================================
// COMPONENTE RAÍZ
// ============================================================
export function NotificationsRoot() {
  const toastList = useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    getToastSnapshot
  );
  const confirmList = useSyncExternalStore(
    subscribeConfirms,
    getConfirmSnapshot,
    getConfirmSnapshot
  );
  const promptList = useSyncExternalStore(
    subscribePrompts,
    getPromptSnapshot,
    getPromptSnapshot
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Toasts */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
      >
        {toastList.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>

      {/* Confirm modals (uno encima de otro si hay varios apilados) */}
      {confirmList.map((c) => (
        <ModalBackdrop key={c.id} onClose={() => resolveConfirm(c.id, false)}>
          <div className="rounded-2xl bg-white shadow-lift p-5 sm:p-6 max-w-md w-full">
            <h3 className="font-display font-extrabold text-lg text-slate-900">
              {c.title}
            </h3>
            {c.message && (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {c.message}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => resolveConfirm(c.id, false)}
                className="btn-ghost text-sm py-1.5 px-3"
              >
                {c.cancelText ?? "Cancelar"}
              </button>
              <button
                onClick={() => resolveConfirm(c.id, true)}
                autoFocus
                className={`text-sm py-1.5 px-3.5 rounded-lg font-bold text-white transition-colors ${
                  c.danger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-brand-600 hover:bg-brand-700"
                }`}
              >
                {c.confirmText ?? "Confirmar"}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      ))}

      {/* Prompt modals */}
      {promptList.map((p) => (
        <PromptModal key={p.id} req={p} />
      ))}
    </>,
    document.body
  );
}

// ============================================================
// COMPONENTES INTERNOS
// ============================================================
function ToastCard({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const styles =
    t.kind === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : t.kind === "error"
      ? "bg-rose-50 border-rose-200 text-rose-800"
      : "bg-white border-slate-200 text-slate-800";
  const icon = t.kind === "success" ? "✓" : t.kind === "error" ? "⚠" : "ℹ";
  return (
    <div
      role="status"
      className={`pointer-events-auto rounded-xl shadow-lift px-4 py-3 text-sm font-semibold border min-w-[260px] flex items-start gap-2 animate-slide-up ${styles}`}
    >
      <span className="font-bold mt-px">{icon}</span>
      <span className="flex-1 leading-snug">{t.message}</span>
      <button
        onClick={onDismiss}
        className="text-current opacity-50 hover:opacity-100 text-base leading-none -mt-0.5"
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

function PromptModal({ req }: { req: PromptReq }) {
  const [value, setValue] = useState(req.defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = value.trim();
    if (req.validate) {
      const err = req.validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    resolvePrompt(req.id, trimmed);
  }
  function cancel() {
    resolvePrompt(req.id, null);
  }

  return (
    <ModalBackdrop onClose={cancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl bg-white shadow-lift p-5 sm:p-6 w-full"
      >
        <h3 className="font-display font-extrabold text-lg text-slate-900">
          {req.title}
        </h3>
        {req.message && (
          <p className="text-sm text-slate-600 mt-1.5">{req.message}</p>
        )}
        {req.label && (
          <label className="text-xs font-bold text-slate-500 mt-4 block uppercase tracking-wider">
            {req.label}
          </label>
        )}
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={req.placeholder}
          className="input mt-2 w-full"
        />
        {error && (
          <p className="text-xs text-rose-600 font-semibold mt-1.5">{error}</p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={cancel}
            className="btn-ghost text-sm py-1.5 px-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm py-1.5 px-3.5 rounded-lg transition-colors"
          >
            {req.confirmText ?? "Guardar"}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
