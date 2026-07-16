"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPickLabel, getDraftBoard, getTeamOnClock } from "@/lib/draft";
import { league } from "@/lib/league";
import {
  DraftPick,
  getCurrentPickNumber,
  getPickByNumber,
  getSavedPicks,
} from "@/lib/picks";
import { getPositionClass } from "@/lib/styles";

export default function DisplayPage() {
  const [picks, setPicks] = useState<DraftPick[]>([]);

  const currentPick = getCurrentPickNumber(picks);
  const currentTeam = getTeamOnClock(currentPick);
  const draftBoard = getDraftBoard(league.numberOfRounds);

  useEffect(() => {
    setPicks(getSavedPicks());

    const interval = window.setInterval(() => {
      setPicks(getSavedPicks());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-3 text-white">
      <section className="mx-auto flex max-w-[1920px] flex-col gap-3">
        <header className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 shadow-2xl">
          <div className="flex items-center justify-between gap-6">
            <div>
  <img
    src="/interesting-league-season-18.png"
    alt="The Interesting League Season 18"
    className="h-24 w-auto"
  />
</div>

            <div className="min-w-64 rounded-2xl border border-yellow-300/40 bg-yellow-300/10 px-5 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-yellow-200">
                On the clock
              </p>
              <p className="mt-0.5 text-3xl font-black text-yellow-100">
                {currentTeam?.displayName ?? "Draft Complete"}
              </p>
              <p className="text-xs font-bold text-slate-300">
                Pick {formatPickLabel(currentPick)}
              </p>
            </div>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
          <div className="grid grid-cols-[46px_repeat(10,minmax(108px,1fr))] border-b border-white/10 bg-slate-950/80">
            <div className="px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Rd
            </div>

            {draftBoard[0].map((pick) => (
              <div
                key={pick.teamId}
                className="border-l border-white/10 px-1 py-1.5 text-center text-xs font-black"
              >
                {pick.teamDisplayName}
              </div>
            ))}
          </div>

          {draftBoard.map((roundPicks) => (
            <div
              key={roundPicks[0].round}
              className="grid grid-cols-[46px_repeat(10,minmax(108px,1fr))] border-b border-white/10 last:border-b-0"
            >
              <div className="flex items-center justify-center bg-slate-950/60 text-sm font-black text-slate-400">
                {roundPicks[0].round}
              </div>

              {roundPicks.map((pick) => {
                const savedPick = getPickByNumber(picks, pick.pickNumber);
                const isCurrentPick = pick.pickNumber === currentPick;

                return (
                  <div
                    key={`${pick.round}-${pick.slot}`}
                    className={`min-h-[49px] border-l border-white/10 p-1 ${
                      isCurrentPick ? "bg-yellow-300/10" : ""
                    }`}
                  >
                    <div
                      className={`flex h-full flex-col justify-between rounded-lg border px-2 py-1.5 ${getPositionClass(
                        savedPick?.player.position
                      )} ${
                        isCurrentPick
                          ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-900"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-bold leading-none text-slate-400">
                          {formatPickLabel(pick.pickNumber)}
                        </span>

                        {savedPick && (
                          <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-black leading-none">
                            {savedPick.player.position}
                          </span>
                        )}
                      </div>

                      {savedPick ? (
                        <div>
                          <p className="truncate text-[11px] font-black leading-tight">
                            {savedPick.player.name}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold leading-none text-slate-300">
                            {savedPick.player.nflTeam}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[11px] font-bold leading-tight text-slate-500">
                            Empty
                          </p>
                          <p className="mt-0.5 truncate text-[10px] leading-none text-slate-600">
                            {pick.teamDisplayName}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Link
            href="/draft"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-white/10 hover:text-slate-300"
          >
            Draft Room
          </Link>
        </div>
      </section>
    </main>
  );
}