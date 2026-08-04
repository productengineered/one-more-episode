"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Watch Next" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/premieres", label: "Premieres" },
  { href: "/shows", label: "Shows" },
  { href: "/add", label: "+ Add" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              active
                ? "bg-zinc-800 text-zinc-50"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
