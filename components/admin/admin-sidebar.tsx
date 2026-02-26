"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/protected/admin/simulators", label: "Simuladores" },
  { href: "/protected/admin/questions", label: "Preguntas" },
  { href: "/protected/admin/topics", label: "Temas" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClassName(active: boolean): string {
  return [
    "rounded-md border px-3 py-2 text-sm transition",
    active
      ? "border-primary bg-primary/10 text-primary"
      : "border-border hover:border-primary/40",
  ].join(" ");
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="flex flex-wrap gap-2 md:hidden">
        {ADMIN_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={linkClassName(isActive(pathname, item.href))}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <aside className="hidden w-64 shrink-0 border-r pr-4 md:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Administrador
        </p>
        <nav className="flex flex-col gap-2">
          {ADMIN_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClassName(isActive(pathname, item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
