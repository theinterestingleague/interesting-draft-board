import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const players = [
  {
    id: "justin-jefferson",
    name: "Justin Jefferson",
    position: "WR",
    nflTeam: "MIN",
  },
  {
    id: "bijan-robinson",
    name: "Bijan Robinson",
    position: "RB",
    nflTeam: "ATL",
  },
  {
    id: "jamar-chase",
    name: "Ja'Marr Chase",
    position: "WR",
    nflTeam: "CIN",
  },
  {
    id: "josh-allen",
    name: "Josh Allen",
    position: "QB",
    nflTeam: "BUF",
  },
  {
    id: "travis-kelce",
    name: "Travis Kelce",
    position: "TE",
    nflTeam: "KC",
  },
  {
    id: "christian-mccaffrey",
    name: "Christian McCaffrey",
    position: "RB",
    nflTeam: "SF",
  },
  {
    id: "ceedee-lamb",
    name: "CeeDee Lamb",
    position: "WR",
    nflTeam: "DAL",
  },
  {
    id: "jahmyr-gibbs",
    name: "Jahmyr Gibbs",
    position: "RB",
    nflTeam: "DET",
  },
  {
    id: "saquon-barkley",
    name: "Saquon Barkley",
    position: "RB",
    nflTeam: "PHI",
  },
  {
    id: "brandon-aubrey",
    name: "Brandon Aubrey",
    position: "K",
    nflTeam: "DAL",
  },
  {
    id: "lamar-jackson",
    name: "Lamar Jackson",
    position: "QB",
    nflTeam: "BAL",
  },
  {
    id: "amon-ra-st-brown",
    name: "Amon-Ra St. Brown",
    position: "WR",
    nflTeam: "DET",
  },
  {
    id: "breece-hall",
    name: "Breece Hall",
    position: "RB",
    nflTeam: "NYJ",
  },
  {
    id: "puka-nacua",
    name: "Puka Nacua",
    position: "WR",
    nflTeam: "LAR",
  },
  {
    id: "sam-laporta",
    name: "Sam LaPorta",
    position: "TE",
    nflTeam: "DET",
  },
  {
    id: "patrick-mahomes",
    name: "Patrick Mahomes",
    position: "QB",
    nflTeam: "KC",
  },
  {
    id: "garrett-wilson",
    name: "Garrett Wilson",
    position: "WR",
    nflTeam: "NYJ",
  },
  {
    id: "derrick-henry",
    name: "Derrick Henry",
    position: "RB",
    nflTeam: "BAL",
  },
  {
    id: "tucker-kraft",
    name: "Tucker Kraft",
    position: "TE",
    nflTeam: "GB",
  },
];

async function main() {
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

  console.log(`Seeded ${players.length} players.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });