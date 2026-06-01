"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { getSocket } from "./socket";
import { playMessageSound, unlockAudio } from "./sound";
import type { ChatMessage } from "./types";

interface ChatUnreadValue {
  unread: number;
  reset: () => void;
  online: { userId: string; name: string }[];
}

const ChatUnreadContext = createContext<ChatUnreadValue>({
  unread: 0,
  reset: () => {},
  online: [],
});

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState<{ userId: string; name: string }[]>([]);

  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const myIdRef = useRef<string | undefined>(user?.id);
  myIdRef.current = user?.id;

  // Contagem inicial vinda do servidor
  useEffect(() => {
    if (!user) return;
    apiFetch<{ count: number }>("/chat/unread-count")
      .then((d) => setUnread(pathRef.current === "/chat" ? 0 : d.count))
      .catch(() => null);
  }, [user]);

  // Incrementa ao receber mensagem de outro quando não está no chat
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onNew = (msg: ChatMessage) => {
      if (msg.user.id === myIdRef.current) return;
      playMessageSound();
      if (pathRef.current === "/chat") return;
      setUnread((c) => c + 1);
    };
    const onPresence = (list: { userId: string; name: string }[]) => setOnline(list);
    socket.on("message:new", onNew);
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("message:new", onNew);
      socket.off("presence:update", onPresence);
    };
  }, [user]);

  // Zera ao entrar no chat
  useEffect(() => {
    if (pathname === "/chat") setUnread(0);
  }, [pathname]);

  // Libera o áudio no primeiro gesto do usuário (política de autoplay)
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <ChatUnreadContext.Provider value={{ unread, reset: () => setUnread(0), online }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread(): ChatUnreadValue {
  return useContext(ChatUnreadContext);
}
