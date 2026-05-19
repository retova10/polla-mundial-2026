// Edge Function: create-user
// Crea un usuario nuevo (solo invocable por administradores).
// Despliegue: supabase functions deploy create-user
//
// Variables de entorno (auto-disponibles en Supabase Edge Runtime):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY

// @ts-ignore -- import remoto resuelto en runtime de Deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-ignore -- Deno global en runtime
declare const Deno: { env: { get(key: string): string | undefined }; serve: (handler: (req: Request) => Promise<Response> | Response) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Falta token de autorización" }, 401);

  // Cliente con el JWT del invocador para verificar quién es
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Sesión inválida" }, 401);

  // Verificar que sea admin
  const { data: profile, error: profErr } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profErr || !profile || profile.role !== "admin") {
    return json({ error: "Solo administradores pueden crear usuarios" }, 403);
  }

  // Cliente con service role para crear usuarios
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: {
    email?: string;
    password?: string;
    display_name?: string;
    phone?: string | null;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const display_name = (body.display_name ?? "").trim() || null;
  const phone = (body.phone ?? "")?.toString().trim() || null;
  const role = body.role === "admin" ? "admin" : "player";

  if (!email || !password) return json({ error: "email y password requeridos" }, 400);
  if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name, phone, role },
  });
  if (createErr) return json({ error: createErr.message }, 400);

  // El trigger ya creó el profile; forzamos rol, phone, y is_approved=true
  // (los usuarios creados por el admin quedan aprobados automáticamente).
  if (created.user) {
    await admin
      .from("profiles")
      .update({ display_name, phone, role, is_approved: true })
      .eq("id", created.user.id);
  }

  return json({ ok: true, user: { id: created.user?.id, email } });
});
