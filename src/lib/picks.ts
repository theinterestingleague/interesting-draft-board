import { mockPlayers } from "@/lib/mock-data";

export type DraftedPlayer = {
  id: string;
  name: string;
  position: string;
  nflTeam: string;
};

export type DraftPick = {
  pickNumber: number;
  teamId: string;
  player: DraftedPlayer;
  note?: string;
  madeByTeamId?: string;
  createdAt: string;
};

export function getSavedPicks(): DraftPick[] {
  if (typeof window === "undefined") {
    return [];
  }

  const savedPicks = window.localStorage.getItem("draftPicks");

  if (!savedPicks) {
    return [];
  }

  try {
    return JSON.parse(savedPicks) as DraftPick[];
  } catch {
    return [];
  }
}

export function savePicks(picks: DraftPick[]) {
  window.localStorage.setItem("draftPicks", JSON.stringify(picks));
}

export function getCurrentPickNumber(picks: DraftPick[]) {
  return picks.length + 1;
}

export function getPickByNumber(picks: DraftPick[], pickNumber: number) {
  return picks.find((pick) => pick.pickNumber === pickNumber);
}

export function searchPlayers(query: string, draftedPlayerIds: string[]) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length < 2) {
    return [];
  }

  return mockPlayers
    .filter((player) => !draftedPlayerIds.includes(player.id))
    .filter((player) => player.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);
}