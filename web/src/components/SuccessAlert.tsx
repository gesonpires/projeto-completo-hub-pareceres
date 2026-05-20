import Link from "next/link";

export function SuccessAlert({
  message,
  dismissHref,
  className,
}: {
  message: string;
  dismissHref: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900",
        className ?? "",
      ].join(" ")}
    >
      <div>{message}</div>
      <Link
        href={dismissHref}
        className="text-xs font-medium text-emerald-900 underline underline-offset-2 hover:text-emerald-950"
      >
        Fechar
      </Link>
    </div>
  );
}

