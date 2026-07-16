"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { findUserByPassword } from "@/lib/auth";
import { league } from "@/lib/league";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const user = findUserByPassword(password);

    if (!user) {
      setError("That password did not match a league manager.");
      return;
    }

    window.localStorage.setItem("draftUser", JSON.stringify(user));
    router.push("/draft");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-yellow-300">
            {league.seasonLabel}
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
            {league.name}
          </h1>

          <p className="mt-3 text-slate-300">
            Private draft room · No ADP · No rankings · No timer
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-white/10 bg-slate-950/70 p-5"
        >
          <label
            htmlFor="password"
            className="text-sm font-bold text-slate-300"
          >
            Enter draft room password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-slate-600"
            placeholder="Last name"
          />

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Use your league last name to enter the draft room. Jason&apos;s
            login opens commissioner controls.
          </p>

          {error && (
            <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-5 block w-full rounded-xl bg-yellow-300 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-yellow-200"
          >
            Enter Draft Room
          </button>
        </form>

        <div className="mt-5 grid gap-3 text-sm text-slate-400 md:grid-cols-2">
          <Link
            href="/display"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
          >
            <p className="font-black text-white">TV Display Mode</p>
            <p className="mt-1 text-xs leading-relaxed">
              Read-only board for the apartment TV.
            </p>
          </Link>

          <Link
            href="/my-team"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
          >
            <p className="font-black text-white">My Team</p>
            <p className="mt-1 text-xs leading-relaxed">
              View roster-style team pages.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}