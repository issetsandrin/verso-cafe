"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useChatUnread } from "@/lib/chatUnread";
import { apiFetch } from "@/lib/api";
import { Avatar } from "./Avatar";
import { IconArrowLeft, IconBell, IconCoffee, IconDots, IconImage } from "./Icons";
import {
  getPushSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "VersoCafé", subtitle: "Quem faz o café hoje?" },
  "/escala": { title: "Escala", subtitle: "Rodízio do café" },
  "/chat": { title: "VersoCafé - Chat", subtitle: "Grupo do café" },
  "/admin": { title: "Administração", subtitle: "Membros e rodízio" },
  "/perfil": { title: "Perfil" },
  "/midias": { title: "Mídias", subtitle: "Fotos do grupo" },
};

export function AppBar() {
  const { user } = useAuth();
  const { online } = useChatUnread();
  const pathname = usePathname();
  const meta = TITLES[pathname] ?? { title: "VersoCafé" };

  const [open, setOpen] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushSupp, setPushSupp] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ isMyTurn: boolean }>("/rotation/today")
      .then((d) => setIsMyTurn(d.isMyTurn))
      .catch(() => null);
    setPushSupp(pushSupported());
    getPushSubscription().then((s) => setPushOn(!!s));
    setSoundOn(isSoundEnabled());
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function togglePush() {
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
      } else {
        setPushOn(await subscribeToPush());
      }
    } finally {
      setPushBusy(false);
    }
  }

  if (!user) return null;

  // No chat: voltar + nome à esquerda; 3 pontinhos (mute) à direita
  if (pathname === "/chat") {
    return (
      <header className="safe-top z-30 flex shrink-0 items-center gap-2 rounded-b-xl bg-accent px-3 py-4 text-white shadow-soft">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15 active:scale-95"
          aria-label="Voltar para o início"
        >
          <IconArrowLeft className="h-6 w-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight">{meta.title}</p>
          {online.length > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {online.length} online
            </p>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/15 active:scale-95"
            aria-label="Mais opções"
          >
            <IconDots className="h-6 w-6" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-40 w-64 animate-fade-up rounded-2xl bg-white p-2 text-coffee-900 shadow-soft ring-1 ring-coffee-100">
              <Link
                href="/midias"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-coffee-800 hover:bg-coffee-50"
              >
                <IconImage className="h-5 w-5 text-accent" /> Ver mídias
              </Link>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-coffee-50">
                <input
                  type="checkbox"
                  checked={!pushOn}
                  onChange={togglePush}
                  disabled={!pushSupp || pushBusy}
                  className="h-5 w-5 shrink-0 accent-accent disabled:opacity-50"
                />
                <span className="text-sm font-medium text-coffee-800">Silenciar notificações</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-coffee-50">
                <input
                  type="checkbox"
                  checked={!soundOn}
                  onChange={toggleSound}
                  className="h-5 w-5 shrink-0 accent-accent"
                />
                <span className="text-sm font-medium text-coffee-800">Silenciar som</span>
              </label>
            </div>
          )}
        </div>
      </header>
    );
  }

  const hasAlert = isMyTurn || (pushSupp && !pushOn);

  return (
    <header className="safe-top z-30 flex shrink-0 items-center justify-between gap-3 rounded-b-xl bg-accent px-4 py-4 text-white shadow-soft">
      {/* Avatar do perfil (esquerda) */}
      <Link href="/perfil" className="active:scale-95" aria-label="Perfil">
        <span className="block rounded-full ring-2 ring-white/50">
          <Avatar id={user.id} name={user.name} size="sm" />
        </span>
      </Link>

      {/* Título central */}
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-sm font-bold leading-tight text-white">{meta.title}</p>
        {meta.subtitle && <p className="truncate text-[11px] text-white/75">{meta.subtitle}</p>}
      </div>

      {/* Notificações (direita) */}
      <div ref={wrapRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95 hover:bg-white/15"
          aria-label="Notificações"
        >
          <IconBell className="h-6 w-6" />
          {hasAlert && (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-accent" />
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-40 w-64 animate-fade-up rounded-2xl bg-white p-3 shadow-soft ring-1 ring-coffee-100">
            <p className="mb-2 px-1 text-sm font-bold text-coffee-900">Notificações</p>

            {isMyTurn ? (
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="mb-2 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm font-medium text-accent-dark"
              >
                <IconCoffee className="h-4 w-4 shrink-0" />
                Hoje é a sua vez de fazer o café!
              </Link>
            ) : (
              <p className="mb-2 px-1 text-sm text-coffee-500">Nenhum aviso novo por enquanto.</p>
            )}

            <div className="flex items-center justify-between gap-2 rounded-xl bg-coffee-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-coffee-800">Avisos no dispositivo</p>
                <p className="text-[11px] text-coffee-500">
                  {pushSupp ? "Café e novas mensagens" : "Não suportado aqui"}
                </p>
              </div>
              <button
                onClick={togglePush}
                disabled={!pushSupp || pushBusy}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  pushOn ? "bg-accent" : "bg-coffee-200"
                } disabled:opacity-50`}
                aria-pressed={pushOn}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    pushOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-coffee-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-coffee-800">Som de mensagens</p>
                <p className="text-[11px] text-coffee-500">Toca ao receber no app</p>
              </div>
              <button
                onClick={toggleSound}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  soundOn ? "bg-accent" : "bg-coffee-200"
                }`}
                aria-pressed={soundOn}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    soundOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
