import { loginAction } from "./actions";
import { ErrorAlert } from "@/components/ErrorAlert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sp?.next ?? "/";
  const error = sp?.error;
  const dismissHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Hub de Pareceres (CEE‑SC)
          </h1>
          <p className="text-sm text-zinc-700">Acesso interno</p>
        </div>

        {error ? (
          <ErrorAlert message={error} dismissHref={dismissHref} className="mt-4" />
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="h-10 w-full rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-xs text-zinc-500">
          Se você acabou de iniciar o projeto, rode o seed para criar o usuário
          admin.
        </p>
      </div>
    </div>
  );
}

