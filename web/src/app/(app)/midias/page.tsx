"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Spinner } from "@/components/Brand";
import { IconClose, IconDownload, IconImage } from "@/components/Icons";
import type { MediaItem } from "@/lib/types";

export default function MidiasPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ media: MediaItem[] }>("/chat/media")
      .then((d) => setMedia(d.media))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-3">
      {loading ? (
        <div className="flex justify-center py-16 text-accent">
          <Spinner className="h-8 w-8" />
        </div>
      ) : media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-coffee-400">
          <IconImage className="mb-3 h-12 w-12" />
          <p className="font-medium">Nenhuma mídia ainda.</p>
          <p className="text-sm">As fotos enviadas no chat aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {media.map(
            (m) =>
              m.imageUrl && (
                <button
                  key={m.id}
                  onClick={() => setLightbox(m.imageUrl)}
                  className="aspect-square overflow-hidden rounded-lg bg-coffee-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.imageUrl}
                    alt="mídia"
                    loading="lazy"
                    className="h-full w-full object-cover transition active:scale-95"
                  />
                </button>
              ),
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <div className="safe-top flex items-center justify-between px-4 py-3 text-white">
            <a
              href={lightbox}
              download
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-white/15"
            >
              <IconDownload className="h-5 w-5" /> Baixar
            </a>
            <button
              onClick={() => setLightbox(null)}
              className="rounded-full p-1 hover:bg-white/15"
              aria-label="Fechar"
            >
              <IconClose className="h-6 w-6" />
            </button>
          </div>
          <div
            className="flex flex-1 items-center justify-center overflow-auto p-3"
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="imagem" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
