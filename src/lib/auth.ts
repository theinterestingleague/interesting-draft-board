import { teams } from "@/lib/league";

export type DraftUser = {
  teamId: string;
  displayName: string;
  isCommissioner: boolean;
};

export function findUserByPassword(password: string): DraftUser | null {
  const normalizedPassword = password.trim().toLowerCase();

  if (!normalizedPassword) {
    return null;
  }

  const team = teams.find((team) =>
    team.passwords.some((teamPassword) => teamPassword === normalizedPassword)
  );

  if (!team) {
    return null;
  }

  return {
    teamId: team.id,
    displayName: team.displayName,
    isCommissioner: team.isCommissioner,
  };
}