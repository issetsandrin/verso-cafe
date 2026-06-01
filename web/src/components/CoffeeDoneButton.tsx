"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Spinner } from "./Brand";
import { IconCamera, IconClose, IconSend } from "./Icons";

export function CoffeeDoneButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function openCamera() {
    inputRef.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCaption("");
    setError("");
  }

  function close() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setCaption("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function send() {
    if (!file || sending) return;
    setSending(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (caption.trim()) fd.append("text", caption.trim());
      fd.append("coffeeProof", "true");
      await apiFetch("/chat/messages", { method: "POST", formData: fd });
      close();
      router.push("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button onClick={openCamera} className="btn-primary w-full">
        <IconCamera className="h-5 w-5" />
        Comprovar café
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />

      {/* Tela de prévia estilo WhatsApp */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="safe-top flex items-center justify-between px-4 py-3 text-white">
            <button onClick={close} className="rounded-full p-1 active:scale-95" aria-label="Fechar">
              <IconClose className="h-6 w-6" />
            </button>
            <span className="text-sm font-medium opacity-80">Enviar para o grupo</span>
            <button onClick={openCamera} className="text-sm font-medium text-accent active:scale-95">
              Refazer
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="café passando" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>

          {error && <p className="px-4 pb-1 text-center text-sm text-red-400">{error}</p>}

          <div className="safe-bottom flex items-end gap-2 bg-black/95 px-3 pb-2 pt-2">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Adicione uma legenda..."
              rows={1}
              className="max-h-28 flex-1 resize-none rounded-2xl bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50 focus:bg-white/15"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              onClick={send}
              disabled={sending}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
              aria-label="Enviar para o chat"
            >
              {sending ? <Spinner className="h-5 w-5" /> : <IconSend className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
