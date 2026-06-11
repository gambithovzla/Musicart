import Link from "next/link";
import { auth, authConfigured } from "@/auth";
import { signInWithEmail, signInWithGoogle } from "./actions";

export const metadata = { title: "Entrar · Musicart" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth();
  const configured = authConfigured();
  const afterLogin =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/entrar/completado";
  const google =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const email =
    Boolean(process.env.AUTH_RESEND_KEY) && Boolean(process.env.EMAIL_FROM);

  if (session?.user) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="font-serif text-2xl">Ya entraste</h1>
        <p className="text-sm text-dim">
          Hola{session.user.name ? `, ${session.user.name}` : ""}. Tu diario y
          tu perfil viajan contigo.
        </p>
        <Link
          href="/perfil"
          className="rounded-2xl bg-album px-6 py-3 font-semibold text-black"
        >
          Ir a mi perfil
        </Link>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-3 px-8 text-center">
        <h1 className="font-serif text-2xl">Entrar</h1>
        <p className="text-sm text-dim">
          Auth no configurado en este entorno. Define{" "}
          <code className="rounded bg-surface px-1">AUTH_SECRET</code> y al
          menos un proveedor (Google o email).
        </p>
      </main>
    );
  }

  return (
    <main className="px-6 pb-10 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Tu cuenta</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">
          Lleva tu diario contigo
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          Entra para que tu perfil, tus reseñas y tu racha sigan en cualquier
          dispositivo. Si sigues anónimo, todo sigue igual que ahora.
        </p>
      </header>

      {google && (
        <form action={signInWithGoogle} className="mt-10">
          <input type="hidden" name="next" value={afterLogin} />
          <button
            type="submit"
            className="w-full rounded-2xl border border-white/15 bg-surface px-6 py-4 text-base font-semibold transition-transform active:scale-[0.98]"
          >
            Continuar con Google
          </button>
        </form>
      )}

      {email && (
        <form action={signInWithEmail} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={afterLogin} />
          <label className="block text-sm text-dim" htmlFor="email">
            O recibe un enlace por email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm placeholder:text-white/25 focus:border-album/60 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-album px-6 py-4 text-base font-semibold text-black"
          >
            Enviar enlace mágico
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-xs text-dim">
        <Link href="/" className="underline underline-offset-2">
          Seguir sin cuenta
        </Link>
      </p>
    </main>
  );
}
