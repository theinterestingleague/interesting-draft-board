import { teams } from "@/lib/league";
import type { DraftPick, DraftedPlayer } from "@/lib/picks";

export type RosterSlotType =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "FLEX"
  | "K"
  | "BENCH";

export type RosterSlot = {
  id: string;
  label: RosterSlotType;
  player: DraftedPlayer | null;
};

const baseRosterSlots: RosterSlot[] = [
  { id: "qb-1", label: "QB", player: null },
  { id: "rb-1", label: "RB", player: null },
  { id: "rb-2", label: "RB", player: null },
  { id: "wr-1", label: "WR", player: null },
  { id: "wr-2", label: "WR", player: null },
  { id: "te-1", label: "TE", player: null },
  { id: "flex-1", label: "FLEX", player: null },
  { id: "flex-2", label: "FLEX", player: null },
  { id: "k-1", label: "K", player: null },
  { id: "bench-1", label: "BENCH", player: null },
  { id: "bench-2", label: "BENCH", player: null },
  { id: "bench-3", label: "BENCH", player: null },
  { id: "bench-4", label: "BENCH", player: null },
  { id: "bench-5", label: "BENCH", player: null },
  { id: "bench-6", label: "BENCH", player: null },
];

function canFitSlot(slotLabel: RosterSlotType, player: DraftedPlayer) {
  if (slotLabel === player.position) {
    return true;
  }

  if (
    slotLabel === "FLEX" &&
    ["RB", "WR", "TE"].includes(player.position)
  ) {
    return true;
  }

  if (slotLabel === "BENCH") {
    return true;
  }

  return false;
}

export function buildRosterForTeam(teamId: string, picks: DraftPick[]) {
  const rosterSlots = baseRosterSlots.map((slot) => ({ ...slot }));
  const teamPicks = picks.filter((pick) => pick.teamId === teamId);

  for (const pick of teamPicks) {
    const openSlot = rosterSlots.find(
      (slot) => !slot.player && canFitSlot(slot.label, pick.player)
    );

    if (openSlot) {
      openSlot.player = pick.player;
    }
  }

  return rosterSlots;
}

export function getTeamById(teamId: string) {
  return teams.find((team) => team.id === teamId);
}