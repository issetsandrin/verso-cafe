"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { IconCoffee } from "@/components/Icons";
import { Spinner } from "@/components/Brand";
import type { ManagedUser } from "@/lib/types";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch<{ users: ManagedUser[] }>("/users");
    setUsers(data.users);
  }, []);

  useEffect(() => {
    // Proteção extra de rota (a navegação já esconde o item para não-admin)
    if (user && user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    load()
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [user, router, load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function act(id: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(id);
    try {
      await fn();
      await load();
      flash(msg);
    } catch {
      flash("Algo deu errado.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regen");
    try {
      const res = await apiFetch<{ message: string }>("/rotation/regenerate", { method: "POST" });
      flash(res.message);
    } catch {
      flash("Não foi possível regenerar.");
    } finally {
      setBusy(null);
    }
  }

  const pending = users.filter((u) => u.status === "PENDING");
  const active = users.filter((u) => u.status === "ACTIVE");
  const disabled = users.filter((u) => u.status === "DISABLED");

  return (
    <div>
      {toast && (
        <div className="sticky top-2 z-20 mx-5 mt-3 rounded-xl bg-coffee-800 px-4 py-2 text-center text-sm text-cream shadow-soft">
          {toast}
        </div>
      )}

      <div className="space-y-6 p-5">
        {loading ? (
          <div className="flex justify-center py-16 text-accent">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            {/* Aprovações pendentes */}
            <section>
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-coffee-800">
                Aguardando aprovação
                {pending.length > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                    {pending.length}
                  </span>
                )}
              </h2>
              {pending.length === 0 ? (
                <p className="text-sm text-coffee-500">Nenhum cadastro pendente.</p>
              ) : (
                <ul className="space-y-2">
                  {pending.map((u) => (
                    <li key={u.id} className="card flex items-center gap-3 p-3">
                      <Avatar id={u.id} name={u.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-coffee-900">{u.name}</p>
                        <p className="truncate text-xs text-coffee-500">{u.email}</p>
                      </div>
                      <button
                        disabled={busy === u.id}
                        onClick={() =>
                          act(u.id, () => apiFetch(`/users/${u.id}/approve`, { method: "POST" }), "Cadastro aprovado!")
                        }
                        className="btn-primary px-3 py-2 text-sm"
                      >
                        Aprovar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Membros ativos */}
            <section>
              <h2 className="mb-2 font-semibold text-coffee-800">Membros ativos ({active.length})</h2>
              <ul className="space-y-2">
                {active.map((u) => (
                  <li key={u.id} className="card p-3">
                    <div className="flex items-center gap-3">
                      <Avatar id={u.id} name={u.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-coffee-900">
                          {u.name}
                          {u.role === "ADMIN" && (
                            <span className="ml-2 rounded bg-coffee-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-coffee-600">
                              Admin
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-coffee-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={busy === u.id}
                        onClick={() =>
                          act(
                            u.id,
                            () => apiFetch(`/users/${u.id}`, { method: "PATCH", body: { eligible: !u.eligible } }),
                            u.eligible ? "Removido do rodízio." : "Incluído no rodízio.",
                          )
                        }
                        className={`btn px-3 py-1.5 text-xs ${
                          u.eligible ? "bg-coffee-100 text-coffee-700" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {u.eligible ? (
                          <>
                            <IconCoffee className="h-3.5 w-3.5" /> No rodízio
                          </>
                        ) : (
                          "Fora do rodízio"
                        )}
                      </button>
                      {u.id !== user?.id && (
                        <>
                          <button
                            disabled={busy === u.id}
                            onClick={() =>
                              act(
                                u.id,
                                () =>
                                  apiFetch(`/users/${u.id}`, {
                                    method: "PATCH",
                                    body: { role: u.role === "ADMIN" ? "MEMBER" : "ADMIN" },
                                  }),
                                "Papel atualizado.",
                              )
                            }
                            className="btn bg-coffee-100 px-3 py-1.5 text-xs text-coffee-700"
                          >
                            {u.role === "ADMIN" ? "Remover admin" : "Tornar admin"}
                          </button>
                          <button
                            disabled={busy === u.id}
                            onClick={() =>
                              act(u.id, () => apiFetch(`/users/${u.id}/disable`, { method: "POST" }), "Usuário desativado.")
                            }
                            className="btn bg-red-50 px-3 py-1.5 text-xs text-red-600"
                          >
                            Desativar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Desativados */}
            {disabled.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold text-coffee-800">Desativados</h2>
                <ul className="space-y-2">
                  {disabled.map((u) => (
                    <li key={u.id} className="card flex items-center gap-3 p-3 opacity-70">
                      <Avatar id={u.id} name={u.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-coffee-900">{u.name}</p>
                        <p className="truncate text-xs text-coffee-500">{u.email}</p>
                      </div>
                      <button
                        disabled={busy === u.id}
                        onClick={() =>
                          act(u.id, () => apiFetch(`/users/${u.id}/approve`, { method: "POST" }), "Reativado!")
                        }
                        className="btn-secondary px-3 py-2 text-sm"
                      >
                        Reativar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Rodízio */}
            <section className="card p-5">
              <h2 className="font-semibold text-coffee-800">Rodízio do café</h2>
              <p className="mb-3 mt-1 text-sm text-coffee-500">
                Regenera a escala futura a partir de hoje com os membros ativos no rodízio. O
                histórico é preservado.
              </p>
              <button onClick={regenerate} disabled={busy === "regen"} className="btn-primary w-full">
                {busy === "regen" ? <Spinner className="h-5 w-5" /> : "Regenerar escala"}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
