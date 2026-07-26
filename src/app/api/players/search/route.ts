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

function getSearchScore(playerName: string, query: string, searchParts: string[]) {
  const normalizedName = normalizeSearchText(playerName);
  const normalizedQuery = normalizeSearchText(query);
  const lowerName = playerName.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (!query) {
    return 0;
  }

  if (lowerName === lowerQuery) {
    return 0;
  }

  if (normalizedName === normalizedQuery) {
    return 1;
  }

  if (lowerName.startsWith(lowerQuery)) {
    return 2;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (lowerName.includes(lowerQuery)) {
    return 4;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 5;
  }

  const normalizedParts = searchParts.map(normalizeSearchText).filter(Boolean);

  if (
    normalizedParts.length > 0 &&
    normalizedParts.every((part) => normalizedName.includes(part))
  ) {
    return 6;
  }

  return 999;
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

  const isBrowsingByPositionAndTeam = Boolean(position && nflTeam);

  if (query.length < 2 && !isBrowsingByPositionAndTeam) {
    return NextResponse.json({ players: [] });
  }

  const draftedPicks = await prisma.draftPick.findMany({
    include: {
      player: true,
    },
  });

  const draftedPlayerKeys = new Set(
    draftedPicks.map((pick) => normalizePlayerKey(pick.player)),
  );

  const searchParts = getSearchParts(query);

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
    },
    orderBy: [
      {
        name: "asc",
      },
    ],
    take: 5000,
  });

  const filteredPlayers = players
    .map((player) => ({
      player,
      searchScore: getSearchScore(player.name, query, searchParts),
    }))
    .filter(({ player, searchScore }) => {
      if (draftedPlayerKeys.has(normalizePlayerKey(player))) {
        return false;
      }

      if (isBrowsingByPositionAndTeam && !query) {
        return true;
      }

      return searchScore < 999;
    })
    .sort((a, b) => {
      if (a.searchScore !== b.searchScore) {
        return a.searchScore - b.searchScore;
      }

      return a.player.name.localeCompare(b.player.name);
    })
    .map(({ player }) => player);

  const undraftedUniquePlayers = Array.from(
    new Map(
      filteredPlayers.map((player) => [normalizePlayerKey(player), player]),
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