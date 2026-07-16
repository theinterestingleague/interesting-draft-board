export const league = {
  name: "The Interesting League",
  seasonLabel: "Season 18",
  numberOfTeams: 10,
  numberOfRounds: 15,
  snakeDraft: true,
  noTimer: true,
};

export const teams = [
  {
    id: "alex",
    displayName: "Alex",
    managerNames: ["Alex Cintado"],
    passwords: ["cintado"],
    isCommissioner: false,
  },
  {
    id: "brian",
    displayName: "Brian",
    managerNames: ["Brian Eirinberg"],
    passwords: ["eirinberg"],
    isCommissioner: false,
  },
  {
    id: "carly",
    displayName: "Carly",
    managerNames: ["Carly Callans"],
    passwords: ["callans"],
    isCommissioner: false,
  },
  {
    id: "cheung",
    displayName: "Cheung",
    managerNames: ["Dan Cheung"],
    passwords: ["cheung"],
    isCommissioner: false,
  },
  {
    id: "cohen",
    displayName: "Cohen",
    managerNames: ["Daniel Cohen"],
    passwords: ["cohen"],
    isCommissioner: false,
  },
  {
    id: "eric",
    displayName: "Eric",
    managerNames: ["Eric Veith"],
    passwords: ["veith"],
    isCommissioner: false,
  },
  {
    id: "melnick",
    displayName: "Melnick",
    managerNames: ["Jake Melnick"],
    passwords: ["melnick"],
    isCommissioner: false,
  },
  {
    id: "scotty",
    displayName: "Scotty",
    managerNames: ["Scotty Hamilton"],
    passwords: ["hamilton"],
    isCommissioner: false,
  },
  {
    id: "jason",
    displayName: "Jason",
    managerNames: ["Jason Doppelt"],
    passwords: ["doppelt"],
    isCommissioner: true,
  },
  {
    id: "sam-jake",
    displayName: "Sam & Jake",
    managerNames: ["Jake Baron", "Sam Alhadeff"],
    passwords: ["baron", "alhadeff"],
    isCommissioner: false,
  },
] as const;

export const rosterRules = {
  totalRosterSpots: 15,
  starters: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    K: 1,
  },
  flexSpots: 2,
  benchSpots: 6,
  allowedPositions: ["QB", "RB", "WR", "TE", "K"],
  flexEligiblePositions: ["RB", "WR", "TE"],
  bannedPositions: ["DEF"],
} as const;

export type Position = keyof typeof rosterRules.starters;
export type Team = (typeof teams)[number];