"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Watch Next" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/discover", label: "Discover" },
  { href: "/shows", label: "Shows" },
  { href: "/add", label: "+ Add" },
  { href: "/movies", label: "Movies", divider: true },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm sm:flex">
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <span key={l.href} className="flex items-center gap-1">
            {"divider" in l && l.divider && (
              <span aria-hidden className="mx-1.5 h-4 w-px bg-zinc-700" />
            )}
            <Link
              href={l.href}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {l.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
