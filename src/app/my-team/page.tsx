"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DraftUser } from "@/lib/auth";
import { teams } from "@/lib/league";
import type { DraftPick } from "@/lib/picks";
import { buildRosterForTeam, getTeamById } from "@/lib/roster";
import { getPositionClass } from "@/lib/styles";

type RosterPlayerWithHeadshot = {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
  headshot?: string | null;
};

type DraftPicksApiResponse = {
  picks?: DraftPick[];
  message?: string;
};

type DraftOrderApiResponse = {
  teamIds?: string[];
  message?: string;
};

const fallbackTeamIds = teams.map((team) => team.id);

function getOrderedTeams(teamIds: string[]) {
  const orderedTeams = teamIds
    .map((teamId) => teams.find((team) => team.id === teamId))
    .filter((team): team is (typeof teams)[number] => Boolean(team));

  const missingTeams = teams.filter(
    (team) => !orderedTeams.some((orderedTeam) => orderedTeam.id === team.id),
  );

  return [...orderedTeams, ...missingTeams];
}

async function readDraftPicksResponse(response: Response) {
  const data = (await response
    .json()
    .catch(() => ({}))) as DraftPicksApiResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Could not load shared draft picks.");
  }

  return data;
}

async function readDraftOrderResponse(response: Response) {
  const data = (await response
    .json()
    .catch(() => ({}))) as DraftOrderApiResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Could not load draft order.");
  }

  return data;
}

export default function MyTeamPage() {
  const router = useRouter();

  const [user, setUser] = useState<DraftUser | null>(null);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [draftOrderTeamIds, setDraftOrderTeamIds] =
    useState<string[]>(fallbackTeamIds);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const orderedTeams = useMemo(
    () => getOrderedTeams(draftOrderTeamIds),
    [draftOrderTeamIds],
  );

  useEffect(() => {
    const savedUser = window.localStorage.getItem("draftUser");

    if (!savedUser) {
      router.push("/");
      return;
    }

    const parsedUser = JSON.parse(savedUser) as DraftUser;

    setUser(parsedUser);
    setSelectedTeamId(parsedUser.teamId);
    setIsCheckingLogin(false);
  }, [router]);

  useEffect(() => {
    if (isCheckingLogin || !user) {
      return;
    }

    loadSharedData();

    const intervalId = window.setInterval(() => {
      loadSharedData({ quiet: true });
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isCheckingLogin, user]);

  async function loadSharedData({ quiet = false } = {}) {
    if (!quiet) {
      setIsLoading(true);
    }

    try {
      const [picksResponse, draftOrderResponse] = await Promise.all([
        fetch("/api/picks", { cache: "no-store" }),
        fetch("/api/draft-order", { cache: "no-store" }),
      ]);

      const picksData = await readDraftPicksResponse(picksResponse);
      const draftOrderData = await readDraftOrderResponse(draftOrderResponse);

      setPicks(picksData.picks ?? []);
      setDraftOrderTeamIds(draftOrderData.teamIds ?? fallbackTeamIds);
      setError("");
    } catch (error) {
      console.error(error);

      if (!quiet) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not load the shared roster data.",
        );
      }
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }

  const selectedTeam = getTeamById(selectedTeamId);

  const rosterSlots = useMemo(() => {
    if (!selectedTeamId) {
      return [];
    }

    return buildRosterForTeam(selectedTeamId, picks);
  }, [selectedTeamId, picks]);

  const selectedTeamPicks = picks.filter(
    (pick) => pick.teamId === selectedTeamId,
  );

  function handleLogout() {
    window.localStorage.removeItem("draftUser");
    router.push("/");
  }

  if (isCheckingLogin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-sm font-bold text-slate-400">
          Checking draft room access...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-6 text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-yellow-300">
                Season 18
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
                My Team
              </h1>

              <p className="mt-2 text-slate-300">
                View your roster or check any other team.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/draft"
                className="rounded-xl bg-yellow-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-yellow-200"
              >
                Back to Draft
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {error && (
          <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            {error}
          </p>
        )}

        {isLoading && (
          <p className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-200">
            Loading shared roster data...
          </p>
        )}

        <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div>
              <p className="text-sm font-bold text-slate-400">Logged in as</p>
              <p className="mt-1 text-xl font-black text-yellow-200">
                {user?.displayName}
                {user?.isCommissioner ? " · Commissioner" : ""}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm font-black text-slate-300">Teams</p>

              <div className="mt-3 space-y-2">
                {orderedTeams.map((team) => {
                  const isSelected = team.id === selectedTeamId;
                  const teamPickCount = picks.filter(
                    (pick) => pick.teamId === team.id,
                  ).length;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${
                        isSelected
                          ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="font-black">{team.displayName}</span>
                      <span className="text-xs font-bold text-slate-500">
                        {teamPickCount}/15
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                  Roster View
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  {selectedTeam?.displayName ?? "Unknown Team"}
                </h2>
              </div>

              <p className="text-sm font-bold text-slate-400">
                {selectedTeamPicks.length} of 15 picks made
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {rosterSlots.map((slot) => {
                const player = slot.player as RosterPlayerWithHeadshot | null;

                return (
                  <div
                    key={slot.id}
                    className={`grid grid-cols-[80px_1fr] items-center rounded-2xl border p-3 ${getPositionClass(
                      player?.position,
                    )}`}
                  >
                    <div>
                      <p className="text-sm font-black text-slate-300">
                        {slot.label}
                      </p>
                    </div>

                    {player ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
                            {player.headshot ? (
                              <img
                                src={player.headshot}
                                alt={player.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-black text-slate-500">
                                {player.position}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-base font-black">
                              {player.name}
                            </p>
                            <p className="text-sm font-semibold text-slate-300">
                              {player.position} · {player.nflTeam}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-black">
                          {player.position}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-slate-500">
                        Empty {slot.label.toLowerCase()} slot
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
