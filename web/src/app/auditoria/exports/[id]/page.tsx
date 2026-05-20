import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit } from "@/server/permissions";
import { JobClient } from "./JobClient";

export default async function AuditoriaExportJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canReadAudit(session.perfil)) redirect("/");

  const { id } = await params;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <JobClient id={id} />
      </div>
    </div>
  );
}

