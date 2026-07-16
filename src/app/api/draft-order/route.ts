import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderedTeams } from "@/lib/draft";
import { teams } from "@/lib/league";

const defaultTeamIds = teams.map((team) => team.id);

function parseTeamIdsJson(teamIdsJson?: string | null) {
  if (!teamIdsJson) {
    return defaultTeamIds;
  }

  try {
    const parsed = JSON.parse(teamIdsJson);

    if (!Array.isArray(parsed)) {
      return defaultTeamIds;
    }

    return parsed.filter((teamId): teamId is string => typeof teamId === "string");
  } catch {
    return defaultTeamIds;
  }
}

function validateTeamIds(teamIds: unknown) {
  if (!Array.isArray(teamIds)) {
    return false;
  }

  if (teamIds.length !== teams.length) {
    return false;
  }

  const allowedTeamIds = new Set(defaultTeamIds);
  const uniqueTeamIds = new Set(teamIds);

  if (uniqueTeamIds.size !== teams.length) {
    return false;
  }

  return teamIds.every(
    (teamId) => typeof teamId === "string" && allowedTeamIds.has(teamId),
  );
}

async function getCurrentDraftOrderTeamIds() {
  const draftOrder = await prisma.draftOrder.findUnique({
    where: {
      id: "main",
    },
  });

  return parseTeamIdsJson(draftOrder?.teamIdsJson);
}

async function getIsEditable() {
  const pickCount = await prisma.draftPick.count();

  return pickCount === 0;
}

export async function GET() {
  const teamIds = await getCurrentDraftOrderTeamIds();
  const orderedTeams = getOrderedTeams(teamIds);
  const isEditable = await getIsEditable();

  return NextResponse.json({
    teamIds: orderedTeams.map((team) => team.id),
    teams: orderedTeams.map((team) => ({
      id: team.id,
      displayName: team.displayName,
    })),
    isEditable,
  });
}

export async function PATCH(request: NextRequest) {
  const pickCount = await prisma.draftPick.count();

  if (pickCount > 0) {
    return NextResponse.json(
      { message: "Draft order can only be changed before the first pick." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const teamIds = body && typeof body === "object" ? body.teamIds : null;

  if (!validateTeamIds(teamIds)) {
    return NextResponse.json(
      { message: "Invalid draft order." },
      { status: 400 },
    );
  }

  await prisma.draftOrder.upsert({
    where: {
      id: "main",
    },
    update: {
      teamIdsJson: JSON.stringify(teamIds),
    },
    create: {
      id: "main",
      teamIdsJson: JSON.stringify(teamIds),
    },
  });

  const orderedTeams = getOrderedTeams(teamIds);

  return NextResponse.json({
    teamIds: orderedTeams.map((team) => team.id),
    teams: orderedTeams.map((team) => ({
      id: team.id,
      displayName: team.displayName,
    })),
    isEditable: true,
  });
}
