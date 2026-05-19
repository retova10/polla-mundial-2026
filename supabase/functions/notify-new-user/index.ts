// Edge Function: notify-new-user
// Se invoca por Database Webhook cuando se inserta una fila en public.profiles.
// Envía un correo al admin (retova10@gmail.com) con los datos del nuevo usuario.
//
// Despliegue:  supabase functions deploy notify-new-user --no-verify-jwt
// (--no-verify-jwt porque el webhook no manda JWT de usuario)
//
// Secrets necesarios (configurar en Supabase Dashboard → Project Settings →
// Edge Functions → Manage secrets, o por CLI: supabase secrets set):
//   RESEND_API_KEY  → API key de Resend (https://resend.com)
//   ADMIN_EMAIL     → retova10@gmail.com (a quién avisar)
//   APP_URL         → URL pública de la app (opcional, para link al panel)
//
// Configurar el webhook: Supabase Dashboard → Database → Webhooks → Create
//   Table:  public.profiles
//   Events: Insert
//   Type:   Supabase Edge Functions
//   Edge Function: notify-new-user

// @ts-ignore -- import remoto resuelto en Deno
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: string;
  is_approved: boolean;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ProfileRow;
  old_record: ProfileRow | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function html(profile: ProfileRow, appUrl: string): string {
  const phone = profile.phone ? `<p><strong>📱 Celular:</strong> ${profile.phone}</p>` : "";
  return `
  <div style="font-family: -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 24px auto; padding: 24px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 60px; height: 60px; line-height: 60px; background: linear-gradient(135deg, #10b981, #047857); border-radius: 16px; color: white; font-size: 28px;">🏆</div>
      <h1 style="margin: 12px 0 4px; color: #0f172a; font-size: 22px;">Nueva inscripción</h1>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Polla Mundial 2026</p>
    </div>
    <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;">
      <p style="margin: 4px 0;"><strong>👤 Nombre:</strong> ${profile.display_name ?? "—"}</p>
      <p style="margin: 4px 0;"><strong>✉️ Correo:</strong> ${profile.email}</p>
      ${phone}
      <p style="margin: 4px 0;"><strong>🕐 Inscrito:</strong> ${new Date(profile.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
    </div>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Este usuario está esperando aprobación. Entra al panel de admin para
      revisarlo y aceptarlo.
    </p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="${appUrl}/admin" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px;">Ir al panel admin</a>
    </div>
    <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 28px;">
      Polla Mundial 2026 · Notificación automática
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "retova10@gmail.com";
  const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY no configurada");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const profile = payload.record;

  // Solo notificar para players (no para el admin que se autocrea)
  if (profile.role === "admin") {
    return new Response(JSON.stringify({ ok: true, skipped: "admin" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subject = `🏆 Nueva inscripción: ${profile.display_name ?? profile.email}`;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Polla Mundial 2026 <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject,
      html: html(profile, APP_URL),
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error("Resend error:", errText);
    return new Response(JSON.stringify({ error: errText }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
