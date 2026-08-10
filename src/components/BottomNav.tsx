"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const ITEMS = [
  {
    href: "/",
    label: "Hoy",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/explorar",
    label: "Explorar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.8-3.8" />
      </svg>
    ),
  },
  {
    href: "/caminos",
    label: "Caminos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M6 20c0-3 4-3 4-6s-4-3-4-6 4-3 4-4" />
        <circle cx="17" cy="6" r="2.2" />
        <path d="M17 8.2V18" strokeDasharray="2 2.5" />
      </svg>
    ),
  },
  {
    href: "/vitrina",
    label: "Vitrina",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/diario",
    label: "Diario",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
        <path d="M5 4v13a3 3 0 0 0 3 3" />
        <path d="M9 9h6M9 13h4" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
  },
];

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0b09]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={haptic}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] tracking-wide transition-colors ${
                active ? "text-album" : "text-dim hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="absolute -top-px h-0.5 w-10 rounded-full bg-album"
                />
              )}
              <motion.span whileTap={{ scale: 0.85 }}>{item.icon}</motion.span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
