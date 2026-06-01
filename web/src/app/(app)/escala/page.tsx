"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Spinner } from "@/components/Brand";
import { Avatar } from "@/components/Avatar";
import { formatCoffeeDate } from "@/lib/format";
import type { CoffeeDay } from "@/lib/types";

export default function EscalaPage() {
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [upcoming, setUpcoming] = useState<CoffeeDay[]>([]);
  const [history, setHistory] = useState<CoffeeDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ upcoming: CoffeeDay[] }>("/rotation/upcoming"),
      apiFetch<{ history: CoffeeDay[] }>("/rotation/history"),
    ])
      .then(([u, h]) => {
        setUpcoming(u.upcoming);
        setHistory(h.history);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const hero = tab === "upcoming" ? upcoming[0] : null;
  const rest = tab === "upcoming" ? upcoming.slice(1) : history;

  return (
    <div className="min-h-full bg-cream pb-8">
      <div className="p-5">
        {/* Tabs */}
        <div className="mb-5 flex rounded-xl bg-coffee-100 p-1">
          {(["upcoming", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                tab === t ? "bg-white text-coffee-900 shadow-sm" : "text-coffee-500"
              }`}
            >
              {t === "upcoming" ? "Próximos" : "Histórico"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-accent">
            <Spinner className="h-8 w-8" />
          </div>
        ) : tab === "upcoming" && upcoming.length === 0 ? (
          <EmptyCard
            title="Nenhum dia agendado"
            subtitle="A próxima rodada do café aparece aqui."
          />
        ) : tab === "history" && history.length === 0 ? (
          <EmptyCard title="Sem histórico ainda" subtitle="Os dias passados aparecem aqui." />
        ) : (
          <div className="space-y-5">
            {/* Destaque: próximo café */}
            {hero && (
              <section className="animate-fade-up overflow-hidden rounded-3xl bg-white shadow-card">
                <div className="bg-gradient-to-br from-accent/15 via-accent/5 to-white px-5 pb-4 pt-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-dark">
                    {hero.isToday ? "Café de hoje" : "Próximo café"}
                  </p>
                  <p className="mt-0.5 text-2xl font-extrabold capitalize leading-tight text-coffee-900">
                    {formatCoffeeDate(hero.date)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 px-5 py-4">
                  {hero.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-full bg-coffee-50 py-1.5 pl-1.5 pr-4"
                    >
                      <Avatar id={m.id} name={m.name} size="sm" />
                      <span className="font-semibold text-coffee-800">{m.name}</span>
                    </div>
                  ))}
                  {hero.members.length === 1 && (
                    <span className="self-center text-xs italic text-coffee-400">café solo</span>
                  )}
                </div>
              </section>
            )}

            {/* Lista dos demais dias */}
            {rest.length > 0 && (
              <div className="animate-fade-up">
                <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-coffee-400">
                  {tab === "upcoming" ? "Próximos dias" : "Dias anteriores"}
                </h2>
                <ul className="space-y-2">
                  {rest.map((day) => (
                    <li
                      key={day.id}
                      className={`flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card ${
                        tab === "history" ? "opacity-80" : ""
                      }`}
                    >
                      <span className="w-24 shrink-0 text-sm font-semibold capitalize text-coffee-700">
                        {formatCoffeeDate(day.date)}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="flex -space-x-2">
                          {day.members.map((m) => (
                            <span key={m.id} className="rounded-full ring-2 ring-white">
                              <Avatar id={m.id} name={m.name} size="xs" />
                            </span>
                          ))}
                        </div>
                        <span className="truncate text-sm text-coffee-600">
                          {day.members.map((m) => m.name.split(" ")[0]).join(" · ")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-card">
      <p className="font-semibold text-coffee-700">{title}</p>
      <p className="text-sm text-coffee-400">{subtitle}</p>
    </div>
  );
}
