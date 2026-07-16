import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const ALLOWED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

function getPlayerName(player) {
  const fullName = player.full_name?.trim();

  if (fullName) {
    return fullName;
  }

  const firstName = player.first_name?.trim() ?? "";
  const lastName = player.last_name?.trim() ?? "";
  const combinedName = `${firstName} ${lastName}`.trim();

  return combinedName || null;
}

function shouldImportPlayer(player) {
  if (!player) {
    return false;
  }

  if (!player.player_id) {
    return false;
  }

  if (!ALLOWED_POSITIONS.has(player.position)) {
    return false;
  }

  if (!getPlayerName(player)) {
    return false;
  }

  // Sleeper uses active=true for current active players.
  // Some useful fantasy players may be temporarily inactive/free agents,
  // so we keep the filter modest for now.
  if (player.active === false) {
    return false;
  }

  return true;
}

async function main() {
  console.log("Fetching Sleeper NFL players...");

  const response = await fetch("https://api.sleeper.app/v1/players/nfl");

  if (!response.ok) {
    throw new Error(`Sleeper request failed: ${response.status}`);
  }

  const sleeperPlayers = await response.json();

  const players = Object.values(sleeperPlayers)
    .filter(shouldImportPlayer)
    .map((player) => ({
      id: String(player.player_id),
      name: getPlayerName(player),
      position: player.position,
      nflTeam: player.team ?? "FA",
      headshot: player.search_rank
        ? `https://sleepercdn.com/content/nfl/players/${player.player_id}.jpg`
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Importing ${players.length} players...`);

  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.id },
      update: player,
      create: player,
    });
  }

  await prisma.draftState.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });

  console.log(`Imported ${players.length} Sleeper players.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });