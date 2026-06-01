"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import { Avatar } from "@/components/Avatar";
import { Spinner, CoffeeLogo } from "@/components/Brand";
import { ReadAvatars, type Reader } from "@/components/ReadAvatars";
import {
  IconCamera,
  IconClose,
  IconCoffee,
  IconDownload,
  IconImage,
  IconPencil,
  IconPlus,
  IconReply,
  IconSend,
  IconSmile,
  IconStar,
  IconTrash,
} from "@/components/Icons";
import { dayKey, formatDayHeader, formatTime } from "@/lib/format";
import type { ChatMessage, CoffeeRating, MessageReaction, ReadState } from "@/lib/types";

// Paleta de cores por usuário (classes estáticas p/ o Tailwind incluir)
const USER_COLORS = [
  { bubble: "bg-rose-50 text-rose-950", name: "text-rose-600" },
  { bubble: "bg-sky-50 text-sky-950", name: "text-sky-700" },
  { bubble: "bg-emerald-50 text-emerald-950", name: "text-emerald-700" },
  { bubble: "bg-violet-50 text-violet-950", name: "text-violet-700" },
  { bubble: "bg-amber-50 text-amber-950", name: "text-amber-700" },
  { bubble: "bg-teal-50 text-teal-950", name: "text-teal-700" },
  { bubble: "bg-fuchsia-50 text-fuchsia-950", name: "text-fuchsia-700" },
  { bubble: "bg-cyan-50 text-cyan-950", name: "text-cyan-700" },
];

function colorForUser(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return USER_COLORS[h % USER_COLORS.length];
}

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
const EMOJI_PICKER_ENABLED = false; // emoji do composer desabilitado temporariamente

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [reads, setReads] = useState<Record<string, { name: string; lastReadAt: string | null }>>({});
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // "visto até" — só avança quando estou no fim do chat e com a aba visível
  const [seenUntil, setSeenUntil] = useState(0);
  const [baselineReady, setBaselineReady] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> nome
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [toast, setToast] = useState("");
  const [, setTick] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const lastMarkRef = useRef(0);
  const atBottomRef = useRef(true);
  const didInitRef = useRef(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingStartRef = useRef(0);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notifyTyping() {
    const socket = getSocket();
    const now = Date.now();
    if (now - typingStartRef.current > 1500) {
      socket.emit("typing", true);
      typingStartRef.current = now;
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      socket.emit("typing", false);
      typingStartRef.current = 0;
    }, 2500);
  }

  function stopTyping() {
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    getSocket().emit("typing", false);
    typingStartRef.current = 0;
  }

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setText((t) => t + emoji);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    setText(ta.value.slice(0, start) + emoji + ta.value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function insertMention(member: { id: string; name: string }) {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? ta.value.length;
    const before = ta.value.slice(0, pos);
    const after = ta.value.slice(pos);
    const m = before.match(/@([\wÀ-ÿ]*)$/);
    if (!m) return;
    const firstName = member.name.split(" ")[0];
    const startIdx = before.length - m[0].length;
    const insert = `@${firstName} `;
    setText(before.slice(0, startIdx) + insert + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const cpos = startIdx + insert.length;
      ta.setSelectionRange(cpos, cpos);
    });
  }

  const markRead = useCallback(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    const now = Date.now();
    if (now - lastMarkRef.current < 1500) return;
    lastMarkRef.current = now;
    apiFetch("/chat/read", { method: "POST" }).catch(() => null);
  }, []);

  // marca como visto (avança o divisor) — só quando realmente vendo o fim
  const markSeen = useCallback(() => {
    setSeenUntil((prev) => Math.max(prev, Date.now()));
    markRead();
  }, [markRead]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const was = atBottomRef.current;
    atBottomRef.current = atBottom;
    if (atBottom && !was && !document.hidden) markSeen();
  }

  const addMessage = useCallback((msg: ChatMessage, position: "end" | "start" = "end") => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return position === "end" ? [...prev, msg] : [msg, ...prev];
    });
  }, []);

  // Mensagens iniciais
  useEffect(() => {
    apiFetch<{ messages: ChatMessage[]; nextBefore: string | null }>("/chat/messages?limit=30")
      .then((data) => {
        setMessages([...data.messages].reverse());
        setNextBefore(data.nextBefore);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  // Membros (para @menção)
  useEffect(() => {
    apiFetch<{ members: { id: string; name: string }[] }>("/users/members")
      .then((d) => setMembers(d.members.map((m) => ({ id: m.id, name: m.name }))))
      .catch(() => null);
  }, []);

  // Cooldown do pedido de café (persiste entre recargas)
  useEffect(() => {
    const saved = Number(localStorage.getItem("vc_coffee_cooldown") || 0);
    if (saved > Date.now()) setCooldownUntil(saved);
  }, []);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setTimeout(() => setTick((x) => x + 1), cooldownUntil - Date.now());
    return () => clearTimeout(t);
  }, [cooldownUntil]);

  // Estado de leitura (e captura do baseline de não lidas ao abrir)
  useEffect(() => {
    apiFetch<{ reads: ReadState[] }>("/chat/reads")
      .then((d) => {
        const map: Record<string, { name: string; lastReadAt: string | null }> = {};
        d.reads.forEach((r) => {
          map[r.userId] = { name: r.name, lastReadAt: r.lastReadAt };
        });
        setReads(map);
        const mine = d.reads.find((r) => r.userId === user?.id);
        setSeenUntil(mine?.lastReadAt ? new Date(mine.lastReadAt).getTime() : 0);
      })
      .catch(() => null)
      .finally(() => setBaselineReady(true));
  }, [user?.id]);

  // Socket realtime
  useEffect(() => {
    const socket = getSocket();
    const onNew = (msg: ChatMessage) => {
      addMessage(msg, "end");
      // se estou vendo o fim, conta como visto; senão, vira "nova mensagem"
      if (atBottomRef.current && !document.hidden) markSeen();
    };
    const onRead = (u: ReadState) =>
      setReads((prev) => ({ ...prev, [u.userId]: { name: u.name, lastReadAt: u.lastReadAt } }));
    const onTyping = (u: { userId: string; name: string; typing: boolean }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (u.typing) next[u.userId] = u.name;
        else delete next[u.userId];
        return next;
      });
      if (typingTimers.current[u.userId]) clearTimeout(typingTimers.current[u.userId]);
      if (u.typing) {
        // segurança: some sozinho se não vier o "stop"
        typingTimers.current[u.userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const n = { ...prev };
            delete n[u.userId];
            return n;
          });
        }, 4000);
      }
    };
    const onReaction = (u: { messageId: string; reactions: MessageReaction[] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === u.messageId ? { ...m, reactions: u.reactions } : m)),
      );
    };
    const onUpdate = (msg: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };
    const onRating = (u: { messageId: string; ratings: CoffeeRating[] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === u.messageId ? { ...m, ratings: u.ratings } : m)),
      );
    };
    socket.on("message:new", onNew);
    socket.on("read:update", onRead);
    socket.on("typing:update", onTyping);
    socket.on("reaction:update", onReaction);
    socket.on("message:update", onUpdate);
    socket.on("rating:update", onRating);
    return () => {
      socket.off("message:new", onNew);
      socket.off("read:update", onRead);
      socket.off("typing:update", onTyping);
      socket.off("reaction:update", onReaction);
      socket.off("message:update", onUpdate);
      socket.off("rating:update", onRating);
    };
  }, [addMessage, markSeen]);

  // Ao focar/voltar a aba: se estou no fim, marca como visto
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && atBottomRef.current) markSeen();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [markSeen]);

  // Fecha o dropdown de anexo ao clicar fora
  useEffect(() => {
    if (!attachOpen) return;
    const onClick = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) setAttachOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [attachOpen]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [emojiOpen]);

  // segue o fim do chat só se eu já estiver no fim
  useEffect(() => {
    if (loading) return;
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers, loading]);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setAttachOpen(false);
  }

  function clearImage() {
    setImage(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function startReply(msg: ChatMessage) {
    setReplyingTo(msg);
    textareaRef.current?.focus();
  }

  function react(messageId: string, emoji: string) {
    apiFetch(`/chat/messages/${messageId}/react`, { method: "POST", body: { emoji } }).catch(
      () => null,
    );
  }

  function rate(messageId: string, stars: number) {
    apiFetch(`/chat/messages/${messageId}/rate`, { method: "POST", body: { stars } }).catch(
      () => null,
    );
  }

  function startCooldown(ms: number) {
    const until = Date.now() + ms;
    setCooldownUntil(until);
    if (typeof localStorage !== "undefined") localStorage.setItem("vc_coffee_cooldown", String(until));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function requestCoffee() {
    if (requesting) return;
    setRequesting(true);
    setRequestError("");
    try {
      await apiFetch("/chat/request-coffee", { method: "POST" });
      setConfirmRequest(false);
      startCooldown(30 * 60 * 1000);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Não foi possível solicitar.";
      setRequestError(message);
      // já está em cooldown no servidor → reflete no botão
      const m = message.match(/(\d+)\s*min/);
      startCooldown((m ? Number(m[1]) : 30) * 60 * 1000);
    } finally {
      setRequesting(false);
    }
  }

  function startEdit(msg: ChatMessage) {
    setEditing(msg);
    setReplyingTo(null);
    setText(msg.text ?? "");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  function removeMessage(msg: ChatMessage) {
    setConfirmDelete(msg);
  }

  async function confirmRemove() {
    if (!confirmDelete) return;
    await apiFetch(`/chat/messages/${confirmDelete.id}`, { method: "DELETE" }).catch(() => null);
    setConfirmDelete(null);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const trimmed = text.trim();

    // Modo edição: só atualiza o texto
    if (editing) {
      if (!trimmed) return;
      setSending(true);
      setError("");
      try {
        await apiFetch(`/chat/messages/${editing.id}`, { method: "PATCH", body: { text: trimmed } });
        setEditing(null);
        setText("");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível editar.");
      } finally {
        setSending(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      return;
    }

    if (!trimmed && !image) return;

    setSending(true);
    setError("");
    try {
      const fd = new FormData();
      if (trimmed) fd.append("text", trimmed);
      if (image) fd.append("image", image);
      if (replyingTo) fd.append("replyToId", replyingTo.id);
      const data = await apiFetch<{ message: ChatMessage }>("/chat/messages", {
        method: "POST",
        formData: fd,
      });
      addMessage(data.message, "end");
      setText("");
      clearImage();
      setReplyingTo(null);
      stopTyping();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
      // mantém o teclado aberto no celular após enviar
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const data = await apiFetch<{ messages: ChatMessage[]; nextBefore: string | null }>(
        `/chat/messages?limit=30&before=${encodeURIComponent(nextBefore)}`,
      );
      setMessages((prev) => [...[...data.messages].reverse(), ...prev]);
      setNextBefore(data.nextBefore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  // Primeira mensagem "nova" (de outro, recebida quando eu não estava vendo)
  const firstNewId = useMemo(() => {
    const m = messages.find(
      (msg) => msg.user.id !== user?.id && new Date(msg.createdAt).getTime() > seenUntil,
    );
    return m?.id ?? null;
  }, [messages, seenUntil, user?.id]);

  // Rolagem inicial: vai até o divisor de novas mensagens, ou ao fim
  useEffect(() => {
    if (loading || !baselineReady || didInitRef.current) return;
    didInitRef.current = true;
    requestAnimationFrame(() => {
      if (firstNewId && dividerRef.current) {
        dividerRef.current.scrollIntoView({ block: "center" });
        atBottomRef.current = false;
      } else {
        bottomRef.current?.scrollIntoView();
        markSeen();
      }
    });
  }, [loading, baselineReady, firstNewId, markSeen]);

  const mentionNames = useMemo(
    () => new Set(members.map((m) => m.name.split(" ")[0].toLowerCase())),
    [members],
  );
  const myFirst = (user?.name.split(" ")[0] ?? "").toLowerCase();
  const mentionMatches =
    mentionQuery === null
      ? []
      : members
          .filter(
            (m) => m.id !== user?.id && m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6);

  const inCooldown = cooldownUntil > Date.now();

  const readersByMessage = useMemo(() => {
    const map: Record<string, Reader[]> = {};
    const myId = user?.id;
    Object.entries(reads).forEach(([uid, info]) => {
      if (uid === myId || !info.lastReadAt) return;
      const t = new Date(info.lastReadAt).getTime();
      let placed: ChatMessage | null = null;
      for (const m of messages) {
        if (new Date(m.createdAt).getTime() <= t) placed = m;
        else break;
      }
      if (placed && placed.user.id !== uid) {
        (map[placed.id] ??= []).push({ id: uid, name: info.name });
      }
    });
    return map;
  }, [reads, messages, user?.id]);

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-bg no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {loading ? (
          <div className="flex justify-center py-16 text-accent">
            <Spinner className="h-8 w-8" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8">
            <div className="flex flex-col items-center rounded-2xl bg-white/90 px-6 py-5 text-center shadow-card ring-1 ring-coffee-100 backdrop-blur-sm">
              <CoffeeLogo className="mb-3 h-12 w-12 text-accent" />
              <p className="font-semibold text-coffee-800">Nenhuma mensagem ainda.</p>
              <p className="text-sm text-coffee-500">Seja o primeiro a postar uma foto do café!</p>
            </div>
          </div>
        ) : (
          <>
            {nextBefore && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full bg-coffee-100 px-4 py-1.5 text-xs font-medium text-coffee-600"
                >
                  {loadingMore ? "Carregando..." : "Carregar anteriores"}
                </button>
              </div>
            )}
            {grouped.map((group) => (
              <div key={group.key} className="space-y-1">
                <div className="sticky top-0 z-10 flex justify-center py-1.5">
                  <span className="rounded-full bg-coffee-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cream shadow-sm">
                    {group.day}
                  </span>
                </div>
                {group.items.map((msg) => (
                  <Fragment key={msg.id}>
                    {msg.id === firstNewId && (
                      <div ref={dividerRef}>
                        <NewMessagesDivider />
                      </div>
                    )}
                    <Bubble
                      msg={msg}
                      mine={msg.user.id === user?.id}
                      readers={readersByMessage[msg.id] || []}
                      onReply={startReply}
                      onImageClick={setLightboxSrc}
                      onReact={react}
                      onRate={rate}
                      onEdit={startEdit}
                      onDelete={removeMessage}
                      isAdmin={user?.role === "ADMIN"}
                      myId={user?.id ?? ""}
                      mentionNames={mentionNames}
                      myFirst={myFirst}
                    />
                  </Fragment>
                ))}
              </div>
            ))}

            {Object.entries(typingUsers).map(([uid, name]) => (
              <div key={`typing-${uid}`} className="flex items-end gap-2">
                <Avatar id={uid} name={name} size="sm" />
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                  <TypingDots />
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="safe-bottom shrink-0 border-t border-coffee-100 bg-white px-3 pt-2">
        {/* Sugestões de @menção */}
        {mentionMatches.length > 0 && (
          <div className="mb-2 max-h-44 overflow-y-auto rounded-xl bg-white shadow-soft ring-1 ring-coffee-100">
            {mentionMatches.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(m)}
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-coffee-50"
              >
                <Avatar id={m.id} name={m.name} size="sm" />
                <span className="text-sm font-medium text-coffee-800">{m.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Editando mensagem */}
        {editing && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-accent bg-coffee-50 px-3 py-2">
            <IconPencil className="h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-accent">Editando mensagem</p>
              <p className="truncate text-xs text-coffee-500">{editing.text}</p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-full p-1 text-coffee-500 hover:bg-coffee-100"
              aria-label="Cancelar edição"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Citação (responder) */}
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-accent bg-coffee-50 px-3 py-2">
            <IconReply className="h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-accent">
                Respondendo a {replyingTo.user.name.split(" ")[0]}
              </p>
              <p className="truncate text-xs text-coffee-500">
                {replyingTo.text ? replyingTo.text : replyingTo.imageUrl ? "Foto" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="rounded-full p-1 text-coffee-500 hover:bg-coffee-100"
              aria-label="Cancelar resposta"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        )}

        {preview && (
          <div className="relative mb-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="prévia" className="h-20 w-20 rounded-lg object-cover" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-coffee-800 text-white"
              aria-label="Remover imagem"
            >
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}

        <input ref={galleryInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickImage}
          className="hidden"
        />

        <div className="flex items-end gap-2 pb-1">
          {/* Balão de escrita com o "+" dentro */}
          <div className="flex flex-1 items-end gap-1 rounded-2xl border border-coffee-200 bg-white px-1.5 py-1 focus-within:border-accent">
            <div ref={attachRef} className="relative">
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-coffee-500 transition hover:bg-coffee-100"
                aria-label="Anexar"
              >
                <IconPlus className={`h-6 w-6 transition ${attachOpen ? "rotate-45" : ""}`} />
              </button>
              {attachOpen && (
                <div className="absolute bottom-12 left-0 z-20 w-40 animate-fade-up rounded-2xl bg-white p-1.5 shadow-soft ring-1 ring-coffee-100">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      cameraInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-coffee-800 hover:bg-coffee-50"
                  >
                    <IconCamera className="h-5 w-5 text-accent" /> Câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      galleryInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-coffee-800 hover:bg-coffee-50"
                  >
                    <IconImage className="h-5 w-5 text-accent" /> Imagem
                  </button>
                </div>
              )}
            </div>

            {/* Emoji (desabilitado temporariamente) */}
            {EMOJI_PICKER_ENABLED && (
              <div ref={emojiRef} className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setEmojiOpen((v) => !v);
                    setAttachOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-coffee-500 transition hover:bg-coffee-100"
                  aria-label="Emoji"
                >
                  <IconSmile className="h-6 w-6" />
                </button>
                {emojiOpen && (
                  <div className="absolute bottom-12 left-0 z-30">
                    <EmojiPicker
                      onEmojiClick={(emojiData: { emoji: string }) => insertEmoji(emojiData.emoji)}
                      width={300}
                      height={380}
                      lazyLoadEmojis
                      searchPlaceholder="Buscar emoji"
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                const val = e.target.value;
                setText(val);
                notifyTyping();
                const before = val.slice(0, e.target.selectionStart ?? val.length);
                const m = before.match(/(?:^|\s)@([\wÀ-ÿ]*)$/);
                setMentionQuery(m ? m[1] : null);
              }}
              placeholder="Escreva uma mensagem..."
              rows={1}
              className="max-h-28 flex-1 resize-none bg-transparent py-2 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  // No celular (toque), Enter quebra linha e NÃO envia
                  const isTouch =
                    typeof window !== "undefined" &&
                    window.matchMedia("(pointer: coarse)").matches;
                  if (isTouch) return;
                  e.preventDefault();
                  send(e);
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (inCooldown) {
                const mins = Math.ceil((cooldownUntil - Date.now()) / 60000);
                showToast(`Você já pediu café. Aguarde ${mins} min para pedir de novo.`);
                return;
              }
              setRequestError("");
              setConfirmRequest(true);
            }}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coffee-100 text-coffee-600 transition active:scale-95 ${
              inCooldown ? "opacity-50" : "hover:bg-coffee-200"
            }`}
            aria-label="Solicitar café"
          >
            <IconCoffee className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={sending || (!text.trim() && !image)}
            onMouseDown={(e) => e.preventDefault()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
            aria-label="Enviar"
          >
            {sending ? <Spinner className="h-5 w-5" /> : <IconSend className="h-5 w-5" />}
          </button>
        </div>
      </form>

      {/* Lightbox de imagem */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <div className="safe-top flex items-center justify-between px-4 py-3 text-white">
            <a
              href={lightboxSrc}
              download
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-white/15"
            >
              <IconDownload className="h-5 w-5" /> Baixar
            </a>
            <button
              onClick={() => setLightboxSrc(null)}
              className="rounded-full p-1 hover:bg-white/15"
              aria-label="Fechar"
            >
              <IconClose className="h-6 w-6" />
            </button>
          </div>
          <div
            className="flex flex-1 items-center justify-center overflow-auto p-3"
            onClick={() => setLightboxSrc(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxSrc} alt="imagem" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-coffee-900">Deseja apagar essa mensagem?</p>
            <p className="mt-1 text-sm text-coffee-500">Essa ação não pode ser desfeita.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={confirmRemove} className="btn flex-1 bg-red-500 text-white">
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de pedido de café */}
      {confirmRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setConfirmRequest(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <IconCoffee className="h-6 w-6" />
            </div>
            <p className="font-semibold text-coffee-900">
              Solicitar aos responsáveis do dia mais café?
            </p>
            <p className="mt-1 text-sm text-coffee-500">Todos no grupo serão avisados do pedido.</p>
            {requestError && <p className="mt-2 text-sm text-red-600">{requestError}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmRequest(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={requestCoffee} disabled={requesting} className="btn-primary flex-1">
                {requesting ? <Spinner className="h-5 w-5" /> : "Solicitar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (avisos rápidos) */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-full bg-coffee-800 px-4 py-2 text-center text-sm text-cream shadow-soft">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function Bubble({
  msg,
  mine,
  readers,
  onReply,
  onImageClick,
  onReact,
  onRate,
  onEdit,
  onDelete,
  isAdmin,
  myId,
  mentionNames,
  myFirst,
}: {
  msg: ChatMessage;
  mine: boolean;
  readers: Reader[];
  onReply: (msg: ChatMessage) => void;
  onImageClick: (src: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRate: (messageId: string, stars: number) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  isAdmin: boolean;
  myId: string;
  mentionNames: Set<string>;
  myFirst: string;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<null | "h" | "v">(null);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const ignoreClickRef = useRef(0);

  const color = colorForUser(msg.user.id);
  const reactions = msg.reactions ?? [];

  const locked = !!msg.isCoffeeProof || !!msg.isCoffeeRequest; // não edita/apaga
  const recent = Date.now() - new Date(msg.createdAt).getTime() < 5 * 60 * 1000;
  const canEdit = !locked && mine && !!msg.text && recent;
  const canDelete = !locked && (isAdmin || (mine && recent));

  const tokens = msg.text ? msg.text.split(/(@[\wÀ-ÿ]+)/g) : [];
  const mentionsMe =
    myFirst.length > 0 &&
    tokens.some((t) => t.startsWith("@") && t.slice(1).toLowerCase() === myFirst);

  function clearLp() {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  }
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
    setDragging(true);
    clearLp();
    lpTimer.current = setTimeout(() => {
      setQuickOpen(true); // segurar = abre reações (estilo WhatsApp)
      longPressedRef.current = true;
      lpTimer.current = null;
    }, 450);
  }
  function onTouchMove(e: React.TouchEvent) {
    const dX = e.touches[0].clientX - startX.current;
    const dY = e.touches[0].clientY - startY.current;
    if (Math.abs(dX) > 10 || Math.abs(dY) > 10) clearLp();
    if (axis.current === null && (Math.abs(dX) > 8 || Math.abs(dY) > 8)) {
      axis.current = Math.abs(dX) > Math.abs(dY) ? "h" : "v";
    }
    if (axis.current === "h" && dX > 0) setDx(Math.min(dX, 70));
  }
  function onTouchEnd() {
    clearLp();
    setDragging(false);
    if (longPressedRef.current) {
      // ignora o "click" sintético disparado logo após o long-press
      ignoreClickRef.current = Date.now() + 600;
      longPressedRef.current = false;
    } else if (dx > 50) {
      onReply(msg);
    }
    setDx(0);
    axis.current = null;
  }

  if (msg.deleted) {
    return (
      <div className={`mb-1 flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        {!mine && <Avatar id={msg.user.id} name={msg.user.name} size="sm" />}
        <div
          className={`flex max-w-[75%] items-center gap-1.5 rounded-2xl px-3 py-2 text-sm italic ${
            mine ? "rounded-br-md bg-coffee-200 text-coffee-500" : "rounded-bl-md bg-white text-coffee-400"
          }`}
        >
          <IconTrash className="h-3.5 w-3.5" />
          Mensagem apagada
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative mb-1 rounded-xl transition-colors ${
        quickOpen ? "bg-accent/10" : ""
      }`}
    >
      {/* Ícone de responder revelado ao arrastar */}
      <div
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-accent"
        style={{ opacity: Math.min(dx / 50, 1) }}
      >
        <IconReply className="h-5 w-5" />
      </div>

      <div
        className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 150ms ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          setQuickOpen(true);
        }}
      >
        {!mine && <Avatar id={msg.user.id} name={msg.user.name} size="sm" />}
        <div
          className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
            mine ? "rounded-br-md bg-accent text-white" : `rounded-bl-md ${color.bubble}`
          } ${mentionsMe && !mine ? "ring-2 ring-accent" : ""}`}
        >
          {!mine && (
            <p className={`mb-0.5 text-xs font-semibold ${color.name}`}>
              {msg.user.name.split(" ")[0]}
            </p>
          )}

          {/* Prova de café */}
          {msg.isCoffeeProof && (
            <div className="mb-1.5">
              <div
                className={`flex items-center gap-1.5 text-sm font-bold ${
                  mine ? "text-white" : "text-accent"
                }`}
              >
                <IconCoffee className="h-4 w-4 shrink-0" />
                Oba, café passado por @{msg.user.name.split(" ")[0]}
              </div>
              <p className={`text-xs ${mine ? "text-white/80" : "text-coffee-500"}`}>
                Hora de avaliar
              </p>
            </div>
          )}

          {/* Citação da mensagem respondida */}
          {msg.replyTo && (
            <div
              className={`mb-1 rounded-md border-l-2 px-2 py-1 text-xs ${
                mine ? "border-white/60 bg-white/15" : "border-black/15 bg-black/5"
              }`}
            >
              <p className="font-semibold">{msg.replyTo.authorName}</p>
              <p className="truncate opacity-80">
                {msg.replyTo.text ? msg.replyTo.text : msg.replyTo.hasImage ? "Foto" : ""}
              </p>
            </div>
          )}

          {msg.imageUrl && <ChatImage src={msg.imageUrl} onOpen={onImageClick} />}
          {msg.text && (
            <p className="whitespace-pre-wrap break-words text-[15px]">
              {tokens.map((t, i) =>
                t.startsWith("@") && mentionNames.has(t.slice(1).toLowerCase()) ? (
                  <span key={i} className={mine ? "font-bold underline" : "font-bold text-accent"}>
                    {t}
                  </span>
                ) : (
                  <Fragment key={i}>{t}</Fragment>
                ),
              )}
            </p>
          )}
          {/* Avaliação da prova de café (1 a 5 estrelas) */}
          {msg.isCoffeeProof && (
            <RatingStars
              ratings={msg.ratings ?? []}
              myId={myId}
              mine={mine}
              canRate={!mine}
              onRate={(s) => onRate(msg.id, s)}
            />
          )}

          <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-coffee-400"}`}>
            {mine && "Entregue · "}
            {formatTime(msg.createdAt)}
            {msg.editedAt && " · editado"}
          </p>
        </div>
      </div>

      {/* Reação/ações estilo WhatsApp (ao segurar a mensagem) */}
      {quickOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              if (Date.now() < ignoreClickRef.current) return;
              setQuickOpen(false);
            }}
          />
          <div
            className={`absolute bottom-full z-20 mb-1 animate-reaction-pop ${
              mine ? "right-0 origin-bottom-right" : "left-10 origin-bottom-left"
            }`}
          >
            <div className="mb-2 flex w-max items-center gap-2 rounded-full bg-white px-3 py-2 shadow-soft ring-1 ring-coffee-100">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(msg.id, e);
                    setQuickOpen(false);
                  }}
                  className="text-3xl leading-none transition hover:-translate-y-0.5 hover:scale-125 active:scale-110"
                >
                  {e}
                </button>
              ))}
            </div>
            {(canEdit || canDelete) && (
              <div
                className={`flex w-max gap-1 rounded-full bg-white p-1 shadow-soft ring-1 ring-coffee-100 ${
                  mine ? "ml-auto" : ""
                }`}
              >
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(msg);
                      setQuickOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-coffee-500 transition hover:bg-coffee-100"
                    aria-label="Editar"
                  >
                    <IconPencil className="h-5 w-5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(msg);
                      setQuickOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50"
                    aria-label="Apagar"
                  >
                    <IconTrash className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Reações — abaixo da mensagem reagida */}
      {reactions.length > 0 && (
        <div
          className={`mt-1 flex flex-wrap gap-1 ${
            mine ? "justify-end pr-1" : "justify-start pl-10"
          }`}
        >
          {reactions.map((r) => {
            const reacted = r.userIds.includes(myId);
            return (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(msg.id, r.emoji)}
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs shadow-sm ${
                  reacted
                    ? "bg-accent text-white"
                    : "border border-coffee-200 bg-white text-coffee-700"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-semibold">{r.userIds.length}</span>
              </button>
            );
          })}
        </div>
      )}
      <ReadAvatars readers={readers} mine={mine} />
    </div>
  );
}

function RatingStars({
  ratings,
  myId,
  mine,
  canRate,
  onRate,
}: {
  ratings: CoffeeRating[];
  myId: string;
  mine: boolean;
  canRate: boolean;
  onRate: (stars: number) => void;
}) {
  const count = ratings.length;
  const avg = count ? ratings.reduce((s, r) => s + r.stars, 0) / count : 0;
  const myStars = ratings.find((r) => r.userId === myId)?.stars ?? 0;
  // quem pode avaliar vê o próprio voto; o autor vê a média geral (sem interagir)
  const display = canRate ? myStars : Math.round(avg);
  const color = mine ? "text-amber-300" : "text-amber-500";
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((s) =>
          canRate ? (
            <button
              key={s}
              type="button"
              onClick={() => onRate(s)}
              aria-label={`${s} estrela${s > 1 ? "s" : ""}`}
              className={`transition active:scale-90 hover:scale-110 ${color}`}
            >
              <IconStar className="h-7 w-7" filled={s <= display} />
            </button>
          ) : (
            <span key={s} className={color}>
              <IconStar className="h-7 w-7" filled={s <= display} />
            </span>
          ),
        )}
      </div>
      <p className={`mt-0.5 text-[11px] ${mine ? "text-white/80" : "text-coffee-500"}`}>
        {count === 0
          ? canRate
            ? "Seja o primeiro a avaliar"
            : "Aguardando avaliações"
          : `Média ${avg.toFixed(1)} · ${count} voto${count > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="typing-dot h-2 w-2 rounded-full bg-coffee-400"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

function NewMessagesDivider() {
  return (
    <div className="my-2 flex items-center gap-2 px-2">
      <div className="h-px flex-1 bg-accent/40" />
      <span className="rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
        Novas mensagens
      </span>
      <div className="h-px flex-1 bg-accent/40" />
    </div>
  );
}

function ChatImage({ src, onOpen }: { src: string; onOpen: (src: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpen(src)}
      className={`relative mb-1 block overflow-hidden rounded-lg ${loaded ? "" : "h-44 w-52"}`}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-coffee-100/80 backdrop-blur-sm">
          <Spinner className="h-6 w-6 text-accent" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="foto"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`max-h-72 w-full rounded-lg object-cover transition-all duration-500 ${
          loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
        }`}
      />
    </button>
  );
}

function groupByDay(messages: ChatMessage[]): { key: string; day: string; items: ChatMessage[] }[] {
  const groups: { key: string; day: string; items: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const key = dayKey(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(msg);
    else groups.push({ key, day: formatDayHeader(msg.createdAt), items: [msg] });
  }
  return groups;
}
