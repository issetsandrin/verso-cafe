"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { CoffeeLogo, Spinner } from "@/components/Brand";
import { IconCheckCircle } from "@/components/Icons";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/register", { method: "POST", body: { name, email, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cadastrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-gradient-to-b from-coffee-50 to-cream px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-soft">
            <CoffeeLogo className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-coffee-900">Criar conta</h1>
          <p className="text-sm text-coffee-500">Seu acesso será liberado pelo administrador</p>
        </div>

        {done ? (
          <div className="card space-y-3 p-6 text-center">
            <IconCheckCircle className="mx-auto h-14 w-14 text-green-500" />
            <p className="font-semibold text-coffee-900">Cadastro enviado!</p>
            <p className="text-sm text-coffee-600">
              Aguarde a aprovação do administrador. Você poderá entrar assim que sua conta for
              liberada.
            </p>
            <Link href="/login" className="btn-primary w-full">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="card space-y-4 p-6">
              <div>
                <label className="label">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Seu nome"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="label">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="mínimo 6 caracteres"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? <Spinner className="h-5 w-5" /> : "Cadastrar"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-coffee-600">
              Já tem conta?{" "}
              <Link href="/login" className="font-semibold text-accent">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
