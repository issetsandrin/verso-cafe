"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useChatUnread } from "@/lib/chatUnread";

type NavItem = { href: string; label: string; icon: React.ReactNode; adminOnly?: boolean };

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d={path} />
    </svg>
  );
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: <Icon path="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" /> },
  {
    href: "/escala",
    label: "Escala",
    icon: <Icon path="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />,
  },
  {
    href: "/chat",
    label: "Chat",
    icon: <Icon path="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />,
  },
  {
    href: "/admin",
    label: "Admin",
    adminOnly: true,
    icon: <Icon path="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z" />,
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: <Icon path="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unread } = useChatUnread();
  const [animating, setAnimating] = useState(false);
  const prevUnread = useRef(unread);

  // Dispara a animação sempre que chega mensagem nova (contador sobe)
  useEffect(() => {
    if (unread > prevUnread.current) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 700);
      prevUnread.current = unread;
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);

  const items = ITEMS.filter((i) => !i.adminOnly || user?.role === "ADMIN");

  return (
    <nav className="safe-bottom z-30 shrink-0 border-t border-coffee-100 bg-white/95 backdrop-blur">
      <div className="flex items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition ${
                active ? "text-accent" : "text-coffee-400 hover:text-coffee-600"
              }`}
            >
              <span
                className={`relative ${
                  item.href === "/chat" && animating ? "animate-wiggle" : ""
                }`}
              >
                {item.icon}
                {item.href === "/chat" && unread > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] animate-badge-pop items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
