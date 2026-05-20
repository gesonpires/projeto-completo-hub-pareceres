import Link from "next/link";
import { ImportadorCsvMvp } from "./ImportadorCsvMvp";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { getSessionFromCookies } from "@/server/auth";
import { canImport } from "@/server/permissions";
import { redirect } from "next/navigation";

export default async function NovaImportacaoPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canImport(session.perfil)) redirect("/importacoes?error=" + encodeURIComponent("Sem permissão para importar."));

  const error = (await searchParams)?.error;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Nova importação</h1>
          <p className="mt-1 text-sm text-zinc-700">
            Formato CSV (MVP). Colunas esperadas:
            <span className="font-medium">
              {" "}
              instituicao_nome, instituicao_cnpj, instituicao_municipio,
              instituicao_uf, processo_numero, processo_ano, processo_status,
              processo_assunto, ato_tipo, ato_numero, ato_data, ato_ementa,
              ato_descricao, evento_tipo, evento_data, evento_descricao,
              documento_tipo, documento_data, documento_titulo
            </span>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              href="/api/importacoes/template.csv"
            >
              Baixar template CSV
            </a>
            <a
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              href="/api/importacoes/template.xlsx"
            >
              Baixar template XLSX
            </a>
          </div>
        </div>
        <Link
          href="/importacoes"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Voltar
        </Link>
      </div>

      {error ? (
        <ErrorAlert message={error} dismissHref="/importacoes/nova" className="mt-6" />
      ) : null}

      <ImportadorCsvMvp />
      </div>
    </div>
  );
}

