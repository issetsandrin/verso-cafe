"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { CoffeeLogo, Spinner } from "@/components/Brand";
import { CoffeeDoneButton } from "@/components/CoffeeDoneButton";
import { IconClipboard, IconCrown, IconStar, IconTrophy } from "@/components/Icons";
import { formatCoffeeDate } from "@/lib/format";
import type { CoffeeDay, RankingEntry, RatingRankEntry, RoundProgress } from "@/lib/types";

interface TodayResponse {
  today: CoffeeDay | null;
  progress: RoundProgress;
  isMyTurn: boolean;
  next: CoffeeDay | null;
  instructions: string;
}

// ouro, prata, bronze
const PODIUM = [
  { grad: "from-yellow-300 to-amber-500", ring: "ring-yellow-300", ped: "h-20" },
  { grad: "from-slate-200 to-slate-400", ring: "ring-slate-300", ped: "h-14" },
  { grad: "from-amber-500 to-amber-800", ring: "ring-amber-500", ped: "h-10" },
];

interface RankItem {
  userId: string;
  name: string;
  value: string;
  type: "count" | "rating";
  meta: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [byCount, setByCount] = useState<RankingEntry[]>([]);
  const [byRating, setByRating] = useState<RatingRankEntry[]>([]);
  const [rankTab, setRankTab] = useState<"count" | "rating">("count");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<TodayResponse>("/rotation/today")
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false));
    apiFetch<{ byCount: RankingEntry[]; byRating: RatingRankEntry[] }>("/rotation/ranking")
      .then((d) => {
        setByCount(d.byCount);
        setByRating(d.byRating);
      })
      .catch(() => null);
  }, []);

  const firstName = user?.name.split(" ")[0] ?? "";
  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const today = data?.today ?? null;
  const todayActive = !!today && today.status !== "DONE" && today.members.length > 0;
  const nextDay = data?.next ?? null;
  const myTurn = todayActive && !!data?.isMyTurn;

  const rankList: RankItem[] =
    rankTab === "count"
      ? byCount.map((r) => ({
          userId: r.userId,
          name: r.name,
          value: String(r.count),
          type: "count" as const,
          meta: r.count === 1 ? "café" : "cafés",
        }))
      : byRating.map((r) => ({
          userId: r.userId,
          name: r.name,
          value: r.average.toFixed(1),
          type: "rating" as const,
          meta: String(r.votes),
        }));

  return (
    <div className="min-h-full bg-cream pb-8">
      {/* Hero / saudação */}
      <header className="relative overflow-hidden bg-gradient-to-b from-accent/15 via-accent/5 to-cream px-5 pb-7 pt-5">
        <CoffeeLogo className="pointer-events-none absolute -right-4 -top-3 h-28 w-28 rotate-12 text-accent/10" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-dark">
          {getGreeting()}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-none tracking-tight text-coffee-900">
          {firstName}
        </h1>
        <p className="mt-1.5 text-sm capitalize text-coffee-500">{dateLabel}</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-accent">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="-mt-3 space-y-5 px-5">
          {/* Card principal: dupla de hoje / próxima */}
          {todayActive && today ? (
            <section className="animate-fade-up overflow-hidden rounded-3xl bg-white shadow-card">
              <div className="flex items-center justify-between px-5 pt-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-coffee-400">
                    Dupla de hoje
                  </p>
                  <p className="text-sm text-coffee-500">Quem faz o café</p>
                </div>
                {myTurn && (
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-dark">
                    Sua vez
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 px-5 pt-4">
                {today.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-full bg-coffee-50 py-1.5 pl-1.5 pr-4"
                  >
                    <Avatar id={m.id} name={m.name} size="sm" />
                    <span className="font-semibold text-coffee-800">{m.name}</span>
                  </div>
                ))}
              </div>

              {data?.instructions && (
                <div className="mx-5 mt-4 flex items-start gap-2 rounded-2xl bg-coffee-50 px-4 py-3">
                  <IconClipboard className="mt-0.5 h-4 w-4 shrink-0 text-coffee-500" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-coffee-500">
                      Instruções
                    </p>
                    <p className="text-sm font-medium text-coffee-800">{data.instructions}</p>
                  </div>
                </div>
              )}

              <div className="p-5 pt-4">
                {myTurn ? (
                  <CoffeeDoneButton />
                ) : (
                  <p className="text-center text-sm text-coffee-400">
                    Bom café para a dupla de hoje!
                  </p>
                )}
              </div>
            </section>
          ) : nextDay ? (
            <section className="animate-fade-up overflow-hidden rounded-3xl border border-dashed border-coffee-300 bg-white shadow-card">
              <div className="px-5 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-coffee-400">
                  {today && today.status === "DONE" ? "Café de hoje concluído" : "Próxima dupla"}
                </p>
                <p className="text-sm font-semibold capitalize text-coffee-600">
                  {formatCoffeeDate(nextDay.date)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 px-5 py-4 opacity-80">
                {nextDay.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-full bg-coffee-50 py-1.5 pl-1.5 pr-4"
                  >
                    <Avatar id={m.id} name={m.name} size="sm" />
                    <span className="font-medium text-coffee-700">{m.name}</span>
                  </div>
                ))}
              </div>
              <p className="px-5 pb-5 text-sm text-coffee-400">
                Fica para {formatCoffeeDate(nextDay.date).toLowerCase()}.
              </p>
            </section>
          ) : (
            <section className="animate-fade-up rounded-3xl bg-white p-6 text-center shadow-card">
              <CoffeeLogo className="mx-auto mb-2 h-10 w-10 text-coffee-300" />
              <p className="font-semibold text-coffee-700">Sem café agendado</p>
              <p className="text-sm text-coffee-400">Aproveite o dia!</p>
            </section>
          )}

          {/* Ranking */}
          <section className="animate-fade-up overflow-hidden rounded-3xl bg-white shadow-card">
            <div className="flex items-center gap-2 px-5 pt-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                <IconTrophy className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-bold text-coffee-900">Ranking do café</h2>
            </div>

            <div className="px-5 pt-4">
              <div className="flex rounded-xl bg-coffee-100 p-1">
                {(["count", "rating"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRankTab(t)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                      rankTab === t ? "bg-white text-coffee-900 shadow-sm" : "text-coffee-500"
                    }`}
                  >
                    {t === "count" ? "Quem mais fez" : "Mais bem avaliados"}
                  </button>
                ))}
              </div>
            </div>

            {rankList.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-coffee-400">
                {rankTab === "count" ? "Ainda ninguém passou café." : "Nenhuma avaliação ainda."}
              </p>
            ) : rankList.length >= 3 ? (
              <>
                {/* Pódio */}
                <div className="flex items-end justify-center gap-3 px-5 pb-1 pt-6">
                  <PodiumCol item={rankList[1]} pos={1} />
                  <PodiumCol item={rankList[0]} pos={0} />
                  <PodiumCol item={rankList[2]} pos={2} />
                </div>
                {/* Restante */}
                {rankList.length > 3 && (
                  <ul className="space-y-1 px-3 pb-3 pt-1">
                    {rankList.slice(3, 10).map((r, i) => (
                      <RankRow key={r.userId} item={r} pos={i + 3} />
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <ul className="space-y-1 p-3">
                {rankList.map((r, i) => (
                  <RankRow key={r.userId} item={r} pos={i} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function PodiumCol({ item, pos }: { item: RankItem; pos: number }) {
  const p = PODIUM[pos];
  return (
    <div className="flex w-1/3 flex-col items-center">
      <div className="relative">
        {pos === 0 && (
          <IconCrown className="absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 text-yellow-400" />
        )}
        <span className={`block rounded-full ring-4 ${p.ring}`}>
          <Avatar id={item.userId} name={item.name} size={pos === 0 ? "lg" : "md"} />
        </span>
      </div>
      <p className="mt-1.5 max-w-full truncate text-xs font-semibold text-coffee-800">
        {item.name.split(" ")[0]}
      </p>
      <p className="flex items-center gap-0.5 text-[11px] font-medium text-coffee-500">
        {item.value}
        {item.type === "rating" ? (
          <>
            <IconStar className="h-3 w-3 text-amber-500" filled />
            <span className="text-coffee-400">({item.meta})</span>
          </>
        ) : (
          <span>{item.meta}</span>
        )}
      </p>
      <div
        className={`mt-2 flex w-full justify-center rounded-t-xl bg-gradient-to-b ${p.grad} ${p.ped}`}
      >
        <span className="mt-1.5 text-xl font-extrabold text-white drop-shadow">{pos + 1}</span>
      </div>
    </div>
  );
}

function RankRow({ item, pos }: { item: RankItem; pos: number }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="w-6 text-center text-sm font-bold text-coffee-400">{pos + 1}</span>
      <Avatar id={item.userId} name={item.name} size="sm" />
      <span className="flex-1 truncate font-medium text-coffee-800">{item.name}</span>
      <span className="flex items-center gap-1 rounded-full bg-coffee-50 px-2.5 py-1 text-sm font-bold text-coffee-700">
        {item.value}
        {item.type === "rating" ? (
          <IconStar className="h-3.5 w-3.5 text-amber-500" filled />
        ) : (
          <span className="text-[10px] font-normal text-coffee-400">{item.meta}</span>
        )}
      </span>
    </li>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
