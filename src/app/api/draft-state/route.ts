import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COMMISSIONER_UNLOCK_PASSWORD = "sproles43";

async function getOrCreateDraftState() {
  return prisma.draftState.upsert({
    where: {
      id: "main",
    },
    update: {},
    create: {
      id: "main",
      isLocked: false,
    },
  });
}

export async function GET() {
  const draftState = await getOrCreateDraftState();

  return NextResponse.json({
    isLocked: draftState.isLocked,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || typeof body.isLocked !== "boolean") {
    return NextResponse.json(
      { message: "Invalid draft state request." },
      { status: 400 },
    );
  }

  if (
    body.isLocked === false &&
    body.unlockPassword !== COMMISSIONER_UNLOCK_PASSWORD
  ) {
    return NextResponse.json(
      { message: "Incorrect unlock password." },
      { status: 403 },
    );
  }

  const draftState = await prisma.draftState.upsert({
    where: {
      id: "main",
    },
    update: {
      isLocked: body.isLocked,
    },
    create: {
      id: "main",
      isLocked: body.isLocked,
    },
  });

  return NextResponse.json({
    isLocked: draftState.isLocked,
  });
}
