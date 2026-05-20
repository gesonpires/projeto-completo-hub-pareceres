import Link from "next/link";

export function ErrorAlert({
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
        "flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900",
        className ?? "",
      ].join(" ")}
    >
      <div>{message}</div>
      <Link
        href={dismissHref}
        className="text-xs font-medium text-rose-900 underline underline-offset-2 hover:text-rose-950"
      >
        Fechar
      </Link>
    </div>
  );
}

