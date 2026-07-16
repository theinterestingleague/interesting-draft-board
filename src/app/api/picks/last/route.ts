import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DraftPick, DraftedPlayer } from "@/lib/picks";

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

async function getIsDraftBoardLocked() {
  const draftState = await prisma.draftState.findUnique({
    where: {
      id: "main",
    },
  });

  return Boolean(draftState?.isLocked);
}

async function rejectIfDraftBoardLocked() {
  const isLocked = await getIsDraftBoardLocked();

  if (!isLocked) {
    return null;
  }

  return NextResponse.json(
    { message: "The draft board is locked." },
    { status: 423 },
  );
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

export async function DELETE() {
  const lockedResponse = await rejectIfDraftBoardLocked();

  if (lockedResponse) {
    return lockedResponse;
  }

  const lastPick = await prisma.draftPick.findFirst({
    orderBy: {
      pickNumber: "desc",
    },
  });

  if (lastPick) {
    await prisma.draftPick.delete({
      where: {
        pickNumber: lastPick.pickNumber,
      },
    });
  }

  const picks = await getAllDraftPicks();

  return NextResponse.json({ picks });
}
