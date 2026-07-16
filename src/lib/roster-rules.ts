import { rosterRules } from "@/lib/league";
import type { DraftPick, DraftedPlayer } from "@/lib/picks";

type PositionNeed = {
  position: string;
  remaining: number;
};

function getTeamPicks(teamId: string, picks: DraftPick[]) {
  return picks.filter((pick) => pick.teamId === teamId);
}

function getPositionCount(teamPicks: DraftPick[], position: string) {
  return teamPicks.filter((pick) => pick.player.position === position).length;
}

function getUnfilledMinimums(teamPicks: DraftPick[]): PositionNeed[] {
  return Object.entries(rosterRules.starters)
    .map(([position, requiredCount]) => {
      const currentCount = getPositionCount(teamPicks, position);

      return {
        position,
        remaining: Math.max(requiredCount - currentCount, 0),
      };
    })
    .filter((need) => need.remaining > 0);
}

export function validatePickAgainstRosterRules({
  teamId,
  picks,
  player,
}: {
  teamId: string;
  picks: DraftPick[];
  player: DraftedPlayer;
}) {
  const teamPicks = getTeamPicks(teamId, picks);
  const picksMade = teamPicks.length;
  const picksRemainingAfterThisPick =
    rosterRules.totalRosterSpots - picksMade - 1;

  const simulatedTeamPicks: DraftPick[] = [
    ...teamPicks,
    {
      pickNumber: -1,
      teamId,
      player,
      madeByTeamId: teamId,
      createdAt: new Date().toISOString(),
    },
  ];

  const unfilledMinimumsAfterPick = getUnfilledMinimums(simulatedTeamPicks);
  const requiredPicksStillNeeded = unfilledMinimumsAfterPick.reduce(
    (total, need) => total + need.remaining,
    0
  );

  if (requiredPicksStillNeeded > picksRemainingAfterThisPick) {
    const neededPositions = getUnfilledMinimums(teamPicks)
      .map((need) => need.position)
      .join(", ");

    return {
      isValid: false,
      message:
        neededPositions.length > 0
          ? `You still need ${neededPositions}. You cannot draft ${player.position} here.`
          : `You cannot draft ${player.position} here because it would make your roster illegal.`,
    };
  }

  return {
    isValid: true,
    message: "",
  };
}