import { teams } from "@/lib/league";

export type DraftPickSlot = {
  round: number;
  slot: number;
  pickNumber: number;
  teamId: string;
  teamDisplayName: string;
};

export function getOrderedTeams(draftOrderTeamIds?: string[]) {
  const defaultTeams = [...teams];

  if (!draftOrderTeamIds || draftOrderTeamIds.length !== teams.length) {
    return defaultTeams;
  }

  const teamsById = new Map<string, (typeof teams)[number]>(
  teams.map((team) => [team.id, team]),
);
  const uniqueTeamIds = new Set(draftOrderTeamIds);

  if (uniqueTeamIds.size !== teams.length) {
    return defaultTeams;
  }

  const orderedTeams = draftOrderTeamIds
    .map((teamId) => teamsById.get(teamId))
    .filter((team): team is (typeof teams)[number] => Boolean(team));

  if (orderedTeams.length !== teams.length) {
    return defaultTeams;
  }

  return orderedTeams;
}

export function getDraftPickSlot(
  round: number,
  slot: number,
  draftOrderTeamIds?: string[],
): DraftPickSlot {
  const orderedTeams = getOrderedTeams(draftOrderTeamIds);
  const isOddRound = round % 2 === 1;

  const pickNumber = isOddRound
    ? (round - 1) * orderedTeams.length + slot + 1
    : (round - 1) * orderedTeams.length + (orderedTeams.length - slot);

  // The rendered board columns stay in the same team order every round.
  // Only the pick number snakes. The team for a visible cell is always
  // the team in that column.
  const team = orderedTeams[slot];

  return {
    round,
    slot,
    pickNumber,
    teamId: team.id,
    teamDisplayName: team.displayName,
  };
}

export function getDraftBoard(
  numberOfRounds: number,
  draftOrderTeamIds?: string[],
): DraftPickSlot[][] {
  const orderedTeams = getOrderedTeams(draftOrderTeamIds);

  return Array.from({ length: numberOfRounds }, (_, roundIndex) => {
    const round = roundIndex + 1;
    return Array.from({ length: orderedTeams.length }, (_, slot) =>
      getDraftPickSlot(round, slot, draftOrderTeamIds),
    );
  });
}

export function getTeamOnClock(
  currentPickNumber: number,
  draftOrderTeamIds?: string[],
) {
  const orderedTeams = getOrderedTeams(draftOrderTeamIds);

  for (let round = 1; round <= 15; round++) {
    for (let slot = 0; slot < orderedTeams.length; slot++) {
      const pick = getDraftPickSlot(round, slot, draftOrderTeamIds);

      if (pick.pickNumber === currentPickNumber) {
        return orderedTeams.find((team) => team.id === pick.teamId);
      }
    }
  }

  return undefined;
}

export function formatPickLabel(pickNumber: number) {
  const round = Math.ceil(pickNumber / teams.length);
  const pickInRound = ((pickNumber - 1) % teams.length) + 1;

  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}
