"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

export type HeaderLink = { href: string; label: string };

export function AppHeaderClient({
  homeLabel,
  subtitle,
  links,
  userName,
  userPerfil,
}: {
  homeLabel: string;
  subtitle: string;
  links: HeaderLink[];
  userName?: string | null;
  userPerfil?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";

  const primaryLinks = useMemo(() => links, [links]);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col">
            <Link href="/" className="truncate text-sm font-semibold text-zinc-900">
              {homeLabel}
            </Link>
            <div className="text-xs text-zinc-600">{subtitle}</div>
          </div>

          {/* Desktop nav (mais discreto/profissional) */}
          <nav className="hidden flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:flex">
            {primaryLinks.map((l) => {
              const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href + "/"));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={[
                    "rounded-md px-2 py-1 font-medium transition-colors",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                  ].join(" ")}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 sm:hidden"
              aria-expanded={open}
              aria-controls="app-nav"
            >
              Menu
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium text-zinc-900">{userName ?? ""}</div>
              <div className="text-[11px] text-zinc-600">{userPerfil ?? ""}</div>
            </div>
            <Link
              href="/logout"
              className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Sair
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        {open ? (
          <div id="app-nav" className="mt-3 sm:hidden">
            <nav className="grid grid-cols-2 gap-2 text-xs">
              {primaryLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-center font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            {userName || userPerfil ? (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-xs font-medium text-zinc-900">{userName ?? ""}</div>
                <div className="text-[11px] text-zinc-600">{userPerfil ?? ""}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

