import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDraftPickSlot } from "@/lib/draft";
import { league, teams } from "@/lib/league";
import { validatePickAgainstRosterRules } from "@/lib/roster-rules";
import type { DraftPick, DraftedPlayer } from "@/lib/picks";

const allowedPositions = ["QB", "RB", "WR", "TE", "K"];
const defaultTeamIds = teams.map((team) => team.id);

type DraftPickWithPlayer = {
  pickNumber: number;
  teamId: string;
  note: string | null;
  madeByTeamId: string | null;
  createdAt: Date;
  player: {
    id: string;
    name: string;
    position: string;
    nflTeam: string;
    headshot: string | null;
  };
};

function normalizeDraftedPlayerKey(player: {
  name: string;
  position: string;
  nflTeam: string;
}) {
  return `${player.name.trim().toLowerCase()}|${player.position
    .trim()
    .toLowerCase()}|${player.nflTeam.trim().toLowerCase()}`;
}

function parseTeamIdsJson(teamIdsJson?: string | null) {
  if (!teamIdsJson) {
    return defaultTeamIds;
  }

  try {
    const parsed = JSON.parse(teamIdsJson);

    if (!Array.isArray(parsed)) {
      return defaultTeamIds;
    }

    const teamIds = parsed.filter(
      (teamId): teamId is string => typeof teamId === "string",
    );
    const allowedTeamIds = new Set<string>(defaultTeamIds);
    const uniqueTeamIds = new Set(teamIds);

    if (
      teamIds.length !== teams.length ||
      uniqueTeamIds.size !== teams.length ||
      !teamIds.every((teamId) => allowedTeamIds.has(teamId))
    ) {
      return defaultTeamIds;
    }

    return teamIds;
  } catch {
    return defaultTeamIds;
  }
}

async function getDraftOrderTeamIds() {
  const draftOrder = await prisma.draftOrder.findUnique({
    where: {
      id: "main",
    },
  });

  return parseTeamIdsJson(draftOrder?.teamIdsJson);
}

function toDraftPick(row: DraftPickWithPlayer): DraftPick {
  return {
    pickNumber: row.pickNumber,
    teamId: row.teamId,
    player: {
      id: row.player.id,
      name: row.player.name,
      position: row.player.position,
      nflTeam: row.player.nflTeam,
      headshot: row.player.headshot,
    } as DraftedPlayer & { headshot?: string | null },
    note: row.note ?? undefined,
    madeByTeamId: row.madeByTeamId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getAllDraftPicks() {
  const rows = await prisma.draftPick.findMany({
    include: {
      player: true,
    },
    orderBy: {
      pickNumber: "asc",
    },
  });

  return rows.map(toDraftPick);
}

function getNextPickNumber(picks: DraftPick[]) {
  if (picks.length === 0) {
    return 1;
  }

  return Math.max(...picks.map((pick) => pick.pickNumber)) + 1;
}

function getTeamForPickNumber(
  pickNumber: number,
  draftOrderTeamIds: string[],
) {
  for (let round = 1; round <= league.numberOfRounds; round++) {
    for (let slot = 0; slot < league.numberOfTeams; slot++) {
      const pickSlot = getDraftPickSlot(round, slot, draftOrderTeamIds);

      if (pickSlot.pickNumber === pickNumber) {
        return pickSlot;
      }
    }
  }

  return null;
}

export async function GET() {
  const picks = await getAllDraftPicks();

  return NextResponse.json({ picks });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "Invalid pick request." },
      { status: 400 },
    );
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const madeByTeamId =
    typeof body.madeByTeamId === "string" ? body.madeByTeamId : undefined;

  if (!playerId) {
    return NextResponse.json(
      { message: "A playerId is required." },
      { status: 400 },
    );
  }

  const existingPicks = await getAllDraftPicks();
  const pickNumber = getNextPickNumber(existingPicks);

  if (pickNumber > league.numberOfTeams * league.numberOfRounds) {
    return NextResponse.json(
      { message: "The draft is already complete." },
      { status: 400 },
    );
  }

  const draftOrderTeamIds = await getDraftOrderTeamIds();
  const pickSlot = getTeamForPickNumber(pickNumber, draftOrderTeamIds);

  if (!pickSlot) {
    return NextResponse.json(
      { message: "Could not find the next draft slot." },
      { status: 400 },
    );
  }

  const player = await prisma.player.findUnique({
    where: {
      id: playerId,
    },
  });

  if (!player) {
    return NextResponse.json(
      { message: "Player not found." },
      { status: 404 },
    );
  }

  if (!allowedPositions.includes(player.position)) {
    return NextResponse.json(
      { message: "That player position is not allowed in this draft." },
      { status: 400 },
    );
  }

  const playerKey = normalizeDraftedPlayerKey(player);

  const alreadyDrafted = existingPicks.some((pick) => {
    return (
      pick.player.id === player.id ||
      normalizeDraftedPlayerKey(pick.player) === playerKey
    );
  });

  if (alreadyDrafted) {
    return NextResponse.json(
      { message: `${player.name} has already been drafted.` },
      { status: 409 },
    );
  }

  const rosterValidation = validatePickAgainstRosterRules({
    teamId: pickSlot.teamId,
    picks: existingPicks,
    player: {
      id: player.id,
      name: player.name,
      position: player.position,
      nflTeam: player.nflTeam,
      headshot: player.headshot,
    } as DraftedPlayer & { headshot?: string | null },
  });

  if (!rosterValidation.isValid) {
    return NextResponse.json(
      { message: rosterValidation.message },
      { status: 400 },
    );
  }

  await prisma.draftPick.create({
    data: {
      pickNumber,
      teamId: pickSlot.teamId,
      playerId: player.id,
      madeByTeamId,
    },
  });

  const picks = await getAllDraftPicks();

  return NextResponse.json({ picks });
}

export async function DELETE() {
  await prisma.draftPick.deleteMany();

  return NextResponse.json({ picks: [] });
}
