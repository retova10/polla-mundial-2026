# Polla Mundial 2026 — Guía de configuración

Esta guía te lleva paso a paso desde cero hasta tener la app corriendo
con Supabase, el admin creado y los 88 partidos cargados.

> Tiempo estimado: **15 minutos**.

---

## 1. Crear el proyecto en Supabase

1. Entra a [https://supabase.com](https://supabase.com) y haz **Sign up**
   (puedes usar tu cuenta de GitHub o tu correo).
2. Confirma el correo si te lo pide.
3. En el dashboard haz clic en **New project**.
4. Configura:
   - **Name**: `polla-mundial-2026` (o lo que quieras)
   - **Database password**: genera una y **guárdala en un sitio seguro**
     (no la vas a usar para login, pero Supabase la pide).
   - **Region**: elige la más cercana — para Colombia, **East US (North Virginia)**
     o **South America (São Paulo)** funcionan bien.
   - **Pricing plan**: **Free** está bien.
5. Haz clic en **Create new project**. Espera ~2 minutos a que termine
   de aprovisionar.

---

## 2. Obtener las claves de API

En el menú izquierdo del dashboard:

1. Ve a **Project Settings** (engranaje abajo a la izquierda) →
   **API**.
2. Copia estos dos valores:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public key** (un JWT largo)
3. Más abajo, también guarda en un lugar seguro la
   **service_role key** — la vas a necesitar solo si despliegas la
   Edge Function (paso 6).

---

## 3. Configurar `.env` del frontend

En la raíz del proyecto:

```bash
cp .env.example .env
```

Edita `.env` y pega los valores del paso 2:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

Guarda el archivo.

---

## 4. Ejecutar el esquema SQL

1. En el dashboard de Supabase, ve a **SQL Editor** (icono de `>` en
   el menú izquierdo) → **New query**.
2. Abre el archivo `supabase/01_schema.sql` del proyecto, copia **todo
   su contenido**, y pégalo en el editor SQL de Supabase.
3. Haz clic en **Run** (esquina inferior derecha o `Ctrl+Enter`).
4. Deberías ver un `Success. No rows returned`.

Esto crea las tablas `profiles`, `matches`, `predictions`, los
triggers y las políticas de seguridad (RLS).

---

## 5. Cargar los partidos del Mundial

1. **New query** otra vez.
2. Abre `supabase/02_seed_matches.sql`, copia todo y pega.
3. **Run**.
4. Para verificar: en el menú izquierdo ve a **Table Editor** →
   **matches**. Deberías ver **88 filas** (72 fase de grupos + 16
   placeholders de octavos).

### 5.b. Migración: campo celular y aprobación de usuarios

Si ya habías corrido el SQL antes de esta versión, ejecuta también:

1. **New query** en el SQL Editor.
2. Pega el contenido de `supabase/03_add_phone_and_approval.sql`.
3. **Run**.

Esto agrega:
- Columna `phone` y `is_approved` en `profiles`.
- Aprueba automáticamente a los admins existentes.
- Bloquea inserts en `predictions` para usuarios no aprobados.

### 5.c. Migración: bloquear admin a un solo correo

1. **New query** en SQL Editor.
2. Pega el contenido de `supabase/04_admin_lock.sql`.
3. **Run**.

Esto:
- Asegura que `retova10@gmail.com` sea admin y esté aprobado.
- Crea un trigger que **impide** que cualquier otro correo se vuelva
  admin (incluso por SQL directo).

### 5.d. Migración: matriz pública entre jugadores

Necesaria para que la página `/matrix` muestre los pronósticos de
**todos** los participantes (no solo los del usuario actual) y revele
las predicciones partido por partido cuando cada uno termina.

1. **New query** en SQL Editor.
2. Pega el contenido de `supabase/08_public_matrix.sql`.
3. **Run**.

Esto agrega tres políticas RLS adicionales (no rompe las anteriores):

- Cualquier usuario **aprobado** puede leer los `profiles` de todos los
  aprobados (id, email, display_name, role).
- Cualquier usuario **aprobado** puede leer todas las `entries`.
- Cualquier usuario **aprobado** puede leer las `predictions` de
  partidos con `status='finished'`. Las de partidos sin empezar o en
  vivo siguen ocultas en la base — no las recibe el cliente.

El admin sigue viendo todo via las políticas `*_admin_select_all`
que ya existían.

> Si **NO** corres esta migración, la matriz seguirá mostrando solo
> la fila del jugador actual y la redacción de la UI no hará nada
> útil (no hay datos que ocultar porque RLS los bloquea antes).

> Nota: los equipos están como `A1`, `A2`, etc. — slots de FIFA
> antes del sorteo. Una vez confirmados los equipos del Mundial 2026,
> puedes editarlos directamente en el Table Editor:
> - Reemplaza el texto del slot por el nombre del país (`A1` → `México`)
> - **Marca `home_is_placeholder` y `away_is_placeholder` en `false`**
>   para que el partido se pueda predecir.
> - Mientras `is_placeholder` sea `true`, los usuarios verán el
>   partido pero **no podrán enviar marcador** (la regla está
>   forzada en la base de datos).

---

## 6. Crear tu usuario admin

Tienes dos opciones — la **A** es la más rápida:

### Opción A — desde el dashboard de Supabase (recomendada)

1. En el menú izquierdo, ve a **Authentication** → **Users** →
   **Add user** → **Create new user**.
2. Ingresa:
   - **Email**: tu correo (`retova10@gmail.com`)
   - **Password**: la que vas a usar para entrar a la app
   - **Auto Confirm User**: ✅ marcado (importante)
3. Haz clic en **Create user**.
4. Ahora hay que cambiarle el rol a `admin`. Ve a **SQL Editor** →
   **New query** y corre:

   ```sql
   update public.profiles
   set role = 'admin', display_name = 'Tu nombre'
   where email = 'retova10@gmail.com';
   ```

   Cambia el correo y el nombre por los tuyos. Run.

5. Listo. Ya puedes entrar a la app con ese correo y contraseña, y
   verás el botón **Admin** en la barra superior.

### Opción B — desplegar la Edge Function (opcional, más automatizado)

Si quieres crear nuevos jugadores **desde el panel admin de la app**
(en lugar de hacerlo desde Supabase Dashboard), necesitas desplegar
la Edge Function `create-user`:

1. Instala el CLI de Supabase:
   ```bash
   npm install -g supabase
   ```
2. Desde la raíz del proyecto:
   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy create-user
   ```
   (`TU_PROJECT_REF` es la parte de la URL antes de `.supabase.co`.)
3. Listo. El botón "Crear nuevo usuario" del panel admin funcionará.

> Si **no** despliegas la Edge Function, el panel admin igual te
> sirve para listar y cambiar roles. Para crear nuevos usuarios
> haces el mismo proceso de la Opción A (Add user en el dashboard
> + dejarlos como `player` por defecto).

---

## 6.4. Notificación por email cuando alguien se registra

Para que te llegue un correo cuando un nuevo usuario se inscriba,
montas dos piezas: una cuenta gratis en **Resend** (servicio de
correo) y un **Database Webhook** que dispara una Edge Function.

### A. Crear cuenta en Resend

1. Entra a [https://resend.com](https://resend.com) → **Sign up**
   (puedes usar GitHub o tu correo).
2. En el dashboard, vas a **API Keys** (menú lateral).
3. **Create API Key** → nombre `polla-mundial`, permiso **Sending
   access**, dominio "All domains". **Add**.
4. **Copia la key** (solo se muestra una vez, empieza con `re_`).

> El plan gratis de Resend permite **3,000 correos/mes y 100/día**
> y el remitente `onboarding@resend.dev` funciona sin verificar
> dominio (perfecto para esto).

### B. Configurar secrets en Supabase

1. En tu proyecto Supabase ve a **Project Settings** (engranaje) →
   **Edge Functions** → **Manage secrets**.
2. Agrega 3 secrets:
   - `RESEND_API_KEY` → la key de Resend que copiaste.
   - `ADMIN_EMAIL` → `retova10@gmail.com`
   - `APP_URL` → `http://localhost:5173` (cámbialo por tu URL de
     producción cuando despliegues).
3. **Save**.

### C. Desplegar la Edge Function `notify-new-user`

Necesitas el CLI de Supabase. Si no lo tienes:

```bash
npm install -g supabase
supabase login
cd "C:\Users\G531GU\Documents\Mundial 2026\polla-mundial-2026"
supabase link --project-ref ieljohrzaqfshywnkjtl
supabase functions deploy notify-new-user --no-verify-jwt
```

> El flag `--no-verify-jwt` es **obligatorio** porque el webhook no
> manda JWT de usuario.

### D. Configurar el Database Webhook

1. En el dashboard de Supabase, menú lateral → **Database** →
   **Webhooks**.
2. **Create a new hook**.
3. Llena:
   - **Name:** `notify-new-registration`
   - **Table:** `profiles` (en `public`)
   - **Events:** marcar solo **Insert** ✅
   - **Type:** **Supabase Edge Functions**
   - **Edge Function:** `notify-new-user`
   - **HTTP Method:** `POST`
   - **HTTP Headers:** se llenan solos.
   - **HTTP Params:** déjalos vacíos.
4. **Create webhook**.

### E. Probar

1. Logout. En `/register` crea una cuenta de prueba con otro correo
   tuyo.
2. En unos segundos debe llegarte un correo a `retova10@gmail.com`
   con asunto **"🏆 Nueva inscripción: ..."**.
3. Revisa también la carpeta de spam la primera vez.

> **Si no llega el correo:**
> - **Database → Webhooks → notify-new-registration → Logs**: ahí ves
>   el resultado de cada disparo.
> - **Edge Functions → notify-new-user → Logs**: muestra los logs de
>   la función. Si dice "RESEND_API_KEY missing", revisa el paso B.

---

## 6.5. Configurar URL de redirect para reset de contraseña

Para que el correo de "¿Olvidaste tu contraseña?" funcione:

1. En el dashboard de Supabase ve a **Authentication** → **URL
   Configuration**.
2. **Site URL**: pon `http://localhost:5173` (en desarrollo).
   Cuando despliegues a producción, cámbialo por la URL pública
   (p. ej. `https://tu-app.vercel.app`).
3. **Redirect URLs**: agrega
   - `http://localhost:5173/reset-password`
   - `http://localhost:5173/**` (más permisivo, para desarrollo)
   - Si ya estás en producción: `https://tu-app.vercel.app/reset-password`
4. Save.

### Personalizar el correo de recuperación (opcional)

En **Authentication** → **Email Templates** → **Reset Password**
puedes traducir/personalizar el texto. El template **debe** contener
la variable `{{ .ConfirmationURL }}`. Ejemplo en español:

```
<h2>Restablecer contraseña — Polla Mundial 2026</h2>
<p>Hola, recibiste este correo porque solicitaste cambiar tu
contraseña. Haz clic en el enlace para crear una nueva:</p>
<p><a href="{{ .ConfirmationURL }}">Restablecer mi contraseña</a></p>
<p>Si no fuiste tú, ignora este correo.</p>
```

> Por defecto Supabase Free permite **3 emails/hora** desde el
> remitente compartido. Si necesitas más, configura un SMTP propio
> en **Project Settings** → **Auth** → **SMTP Settings**.

---

## 7. Correr la app

```bash
npm install   # solo la primera vez
npm run dev
```

Abre `http://localhost:5173`, entra con tu correo/contraseña, y
verás el dashboard con los partidos.

Para el build de producción:

```bash
npm run build
npm run preview
```

---

## 8. Cómo funciona el bloqueo de marcadores

- Cada partido tiene un campo `kickoff_at` en UTC.
- La app calcula la hora **Colombia (UTC−5)** automáticamente
  (`date-fns-tz`, sin DST).
- Un partido queda bloqueado cuando faltan **menos de 2 horas** para
  el inicio.
- El bloqueo está enforced en **dos capas**:
  1. **Frontend**: deshabilita los inputs y el botón.
  2. **Base de datos**: un trigger PL/pgSQL rechaza inserts/updates
     en `predictions` si `now() >= kickoff_at - 2h`. Aunque alguien
     intente burlar la UI, la DB lo bloquea.

---

## 9. Ajustar fechas/horas de partidos

Las horas que cargué son **una aproximación** del calendario FIFA
publicado. Si la hora oficial difiere, edita en el Table Editor:

- Tabla `matches` → columna `kickoff_at`
- Formato: timestamp con timezone, p. ej.
  `2026-06-11 17:00:00+00` (UTC) o `2026-06-11 12:00:00-05`
  (hora Colombia, equivalentes).

> Recomendado: edítalas en UTC. La app las traduce sola a hora
> Colombia.

---

## 9.5. Flujo de registro y aprobación

A partir de esta versión:

- **Cualquiera puede registrarse** desde `/register` con nombre,
  celular, correo y contraseña.
- Al registrarse, su cuenta queda con `is_approved = false`.
- Si Supabase tiene **Email confirmation activado** (default), el
  usuario primero confirma su correo.
- Cuando intenta entrar, ve la pantalla **"Esperando aprobación"**.
- Tú entras al **Panel admin**, ves la sección **"Pendientes de
  aprobación"** con sus datos, y haces clic en **Aprobar**.
- A partir de ese momento el usuario ya puede enviar marcadores.

Si quieres saltarte la confirmación de correo (para el polla
informal entre amigos), ve a **Authentication** → **Providers** →
**Email** y desactiva **Confirm email**. Así los usuarios pueden
entrar inmediatamente al estado "esperando aprobación" sin tener
que confirmar.

Si quieres **deshabilitar la aprobación** (todos los registros
quedan activos automáticamente), ejecuta este SQL en Supabase:

```sql
alter table public.profiles alter column is_approved set default true;
update public.profiles set is_approved = true where is_approved = false;
```

---

## 10. ¿Qué falta?

Esta es la base. Faltan (los harás cuando quieras):

- [ ] Sistema de **puntos por marcador acertado** (exacto, ganador,
      diferencia, etc.) — definirás las reglas tú.
- [ ] **Ranking** entre todos los participantes.
- [ ] (Opcional) Que el admin pueda ingresar el **resultado real**
      desde la UI cuando termine cada partido (por ahora se hace en
      Supabase Table Editor).
- [ ] (Opcional) Generación dinámica de octavos→cuartos→semis→final
      a partir de los resultados de la fase de grupos.

---

## 11. Modo demo (testing funcional del scoring)

Para ensayar que el cálculo de puntos y el orden del leaderboard estén
correctos sin esperar a que pasen los partidos reales, hay un **modo
demo** que desactiva las restricciones temporales de la UI:

1. Edita `.env` y pon:
   ```
   VITE_DEMO_MODE=true
   ```
2. Reinicia `npm run dev`.
3. Verás un banner amarillo arriba: **"⚠️ MODO DEMO ACTIVO"**.

### Qué hace el modo demo

- `isLocked()` siempre devuelve `false` → los jugadores pueden
  crear/editar pronósticos en cualquier partido sin importar la
  proximidad del kickoff.
- `isMatchLive()` ignora la ventana horaria de 2.5h tras el kickoff
  → el badge "EN VIVO" depende **solo** de que el `status` del partido
  sea `live`. Tú lo controlas desde `/admin/scores`.
- El flag `paid` se ignora → **todas** las entries aparecen en el
  leaderboard (no solo las pagadas) y los inputs de marcador se
  habilitan aunque la entry no esté pagada. El banner rojo "Polla
  pendiente de pago" no se muestra.

### Flujo sugerido para validar puntos y orden

1. Asegúrate de tener varias cuentas demo aprobadas (puedes crearlas
   desde `/admin` o directamente en Supabase).
2. Loguéate con cada cuenta y mete pronósticos para los partidos que
   quieras ensayar (un grupo entero, p. ej. Grupo A).
3. Vuelve como admin a `/admin/scores`, edita los marcadores y marca
   `status = "finished"` con los resultados que quieras simular.
4. Abre `/mundial` (tabla de posiciones) y `/` (leaderboard de
   pronósticos) y verifica:
   - Las **3 victorias / empates / derrotas / GF / GC / DG** del grupo
     coinciden con lo que esperas (`computeGroupStandings`).
   - Los **puntos por jugador** coinciden con la regla:
     - 4 pts marcador exacto
     - 3 pts ganador correcto + un score
     - 2 pts solo ganador o empate correcto
     - 1 pt empate predicho con un score
     - 0 pts ganador contrario
5. Cuando termines, vuelve a poner `VITE_DEMO_MODE=false` y reinicia.

### Limitación importante (lock en la base de datos)

El bloqueo de 2h también está aplicado por un **trigger PL/pgSQL** en
Supabase (`enforce_prediction_lock`). El modo demo **no toca eso**
porque los partidos del Mundial están en 2026 y aún no estás dentro
de las 2h previas — los inserts/updates en `predictions` pasan sin
problema. Si en algún momento quieres ensayar pronósticos sobre un
partido cuyo `kickoff_at` ya está dentro de la ventana de 2h, tendrás
que adelantar el `kickoff_at` del partido (Table Editor → `matches`)
o desactivar temporalmente el trigger.

> **Recordatorio:** el cálculo de puntos (`computeEntryScore`) y el
> orden del leaderboard **no dependen del reloj** — solo miran
> `status='finished'` y los marcadores. Por eso no hace falta
> "engañar" al sistema más allá del lock de UI.

---

## Troubleshooting

**"Faltan VITE_SUPABASE_URL..."** — el archivo `.env` no existe o no
tiene los valores. Revisa el paso 3 y reinicia `npm run dev`.

**"Invalid login credentials"** — el correo no existe en Supabase
o la contraseña es incorrecta. Crea/recrea el usuario en
**Authentication → Users**.

**"new row violates row-level security policy"** — significa que
el RLS está activo pero falta una política. Revisa que ejecutaste
`01_schema.sql` completo.

**El partido aparece pero no me deja predecir** — está marcado como
placeholder (`home_is_placeholder` o `away_is_placeholder` en
`true`). Cuando edites los nombres reales de los equipos, ponlos
en `false`.
