import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DraftPick, DraftedPlayer } from "@/lib/picks";

type RouteContext = {
  params: Promise<{
    pickNumber: string;
  }>;
};

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { pickNumber: pickNumberParam } = await context.params;
  const pickNumber = Number(pickNumberParam);

  if (!Number.isInteger(pickNumber)) {
    return NextResponse.json(
      { message: "Invalid pick number." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "Invalid edit request." },
      { status: 400 }
    );
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : undefined;
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim()
      : null;

  if (playerId) {
    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      return NextResponse.json(
        { message: "Replacement player not found." },
        { status: 404 }
      );
    }

    const duplicate = await prisma.draftPick.findFirst({
      where: {
        playerId,
        pickNumber: {
          not: pickNumber,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { message: `${player.name} has already been drafted.` },
        { status: 409 }
      );
    }
  }

  await prisma.draftPick.update({
    where: {
      pickNumber,
    },
    data: {
      ...(playerId ? { playerId } : {}),
      note,
    },
  });

  const picks = await getAllDraftPicks();

  return NextResponse.json({ picks });
}
