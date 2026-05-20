import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h1 className="text-lg font-semibold tracking-tight">
            Início
          </h1>
          <p className="mt-2 text-sm text-zinc-700">
            Acesse a busca institucional para consultar e consolidar histórico
            regulatório.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/instituicoes"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Buscar instituições
            </Link>
            <Link
              href="/importacoes"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Importações
            </Link>
            <Link
              href="/auditoria"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Auditoria
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
