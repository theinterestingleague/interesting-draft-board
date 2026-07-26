import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_POSITIONS = ["QB", "RB", "WR", "TE", "K"];

function normalizePlayerKey(player: {
  name: string;
  position: string;
  nflTeam: string;
}) {
  return `${player.name.trim().toLowerCase()}|${player.position
    .trim()
    .toLowerCase()}|${player.nflTeam.trim().toLowerCase()}`;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getSearchParts(query: string) {
  return query
    .trim()
    .split(/[\s.'’`-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const draftedIds = request.nextUrl.searchParams.get("draftedIds") ?? "";
  const position = request.nextUrl.searchParams.get("position")?.trim() ?? "";
  const nflTeam = request.nextUrl.searchParams.get("nflTeam")?.trim() ?? "";

  const draftedPlayerIds = draftedIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const draftedPicks = await prisma.draftPick.findMany({
    include: {
      player: true,
    },
  });

  const draftedPlayerKeys = new Set(
    draftedPicks.map((pick) => normalizePlayerKey(pick.player)),
  );

  const isBrowsingByPositionAndTeam = Boolean(position && nflTeam);

  if (query.length < 2 && !isBrowsingByPositionAndTeam) {
    return NextResponse.json({ players: [] });
  }

  const searchParts = getSearchParts(query);
  const normalizedQuery = normalizeSearchText(query);

  const broadNameQuery =
    searchParts.find((part) => part.length >= 3) ??
    searchParts.find((part) => part.length >= 2) ??
    query;

  const players = await prisma.player.findMany({
    where: {
      id: {
        notIn: draftedPlayerIds,
      },
      position: position
        ? {
            equals: position,
          }
        : {
            in: ALLOWED_POSITIONS,
          },
      nflTeam: nflTeam
        ? {
            equals: nflTeam,
          }
        : undefined,
      name:
        broadNameQuery.length >= 2 && !isBrowsingByPositionAndTeam
          ? {
              contains: broadNameQuery,
              mode: "insensitive",
            }
          : undefined,
    },
    orderBy: [
      {
        name: "asc",
      },
    ],
    take: isBrowsingByPositionAndTeam ? 200 : 200,
  });

  const filteredPlayers = players.filter((player) => {
    if (!query) {
      return true;
    }

    const normalizedName = normalizeSearchText(player.name);
    const lowerName = player.name.toLowerCase();
    const lowerQuery = query.toLowerCase();

    return (
      lowerName.includes(lowerQuery) ||
      normalizedName.includes(normalizedQuery) ||
      searchParts.every((part) =>
        normalizedName.includes(normalizeSearchText(part)),
      )
    );
  });

  const undraftedUniquePlayers = Array.from(
    new Map(
      filteredPlayers
        .filter((player) => !draftedPlayerKeys.has(normalizePlayerKey(player)))
        .map((player) => [normalizePlayerKey(player), player]),
    ).values(),
  ).slice(0, isBrowsingByPositionAndTeam ? 100 : 12);

  return NextResponse.json({
    players: undraftedUniquePlayers.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      nflTeam: player.nflTeam,
      headshot: player.headshot,
    })),
  });
}