"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { IconKey } from "@/components/Icons";
import { Spinner } from "@/components/Brand";

export default function PerfilPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [showPwd, setShowPwd] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdBusy(true);
    setPwdMsg(null);
    try {
      await apiFetch("/auth/password", {
        method: "PATCH",
        body: { currentPassword: current, newPassword: next },
      });
      setPwdMsg({ type: "ok", text: "Senha alterada com sucesso!" });
      setCurrent("");
      setNext("");
      setShowPwd(false);
    } catch (err) {
      setPwdMsg({ type: "err", text: err instanceof ApiError ? err.message : "Erro ao alterar." });
    } finally {
      setPwdBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div>
      <div className="space-y-5 p-5">
        {/* Cartão do usuário */}
        <section className="card flex items-center gap-4 p-5">
          <Avatar id={user.id} name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-coffee-900">{user.name}</p>
            <p className="truncate text-sm text-coffee-500">{user.email}</p>
            <div className="mt-1 flex gap-2">
              {user.role === "ADMIN" && (
                <span className="rounded bg-coffee-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-coffee-600">
                  Admin
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  user.eligible ? "bg-green-100 text-green-700" : "bg-coffee-100 text-coffee-500"
                }`}
              >
                {user.eligible ? "No rodízio" : "Fora do rodízio"}
              </span>
            </div>
          </div>
        </section>

        {/* Trocar senha */}
        <section className="card p-5">
          {!showPwd ? (
            <button onClick={() => setShowPwd(true)} className="btn-ghost w-full justify-start px-0">
              <IconKey className="h-5 w-5" /> Trocar senha
            </button>
          ) : (
            <form onSubmit={changePassword} className="space-y-3">
              <p className="font-semibold text-coffee-800">Trocar senha</p>
              <div>
                <label className="label">Senha atual</label>
                <input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Nova senha</label>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="input"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={pwdBusy} className="btn-primary flex-1">
                  {pwdBusy ? <Spinner className="h-5 w-5" /> : "Salvar"}
                </button>
                <button type="button" onClick={() => setShowPwd(false)} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {pwdMsg && (
            <p className={`mt-2 text-sm ${pwdMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {pwdMsg.text}
            </p>
          )}
        </section>

        <button onClick={handleLogout} className="btn w-full bg-red-50 text-red-600">
          Sair da conta
        </button>
      </div>
    </div>
  );
}
