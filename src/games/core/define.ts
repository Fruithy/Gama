import type { GameDefinition } from "./types";

type Optional =
  | "id"
  | "status"
  | "supportsMobile"
  | "supportsDesktop"
  | "usesCamera"
  | "usesMicrophone"
  | "version"
  | "leaderboardType"
  | "scoreDirection"
  | "scoreFormat"
  | "scoreUnit"
  | "dailyEligible";

export type GameDefinitionInput = Omit<GameDefinition, Optional> & Partial<Pick<GameDefinition, Optional>>;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Fill sensible defaults for a game definition. Keeps every meta.ts short and
 * guarantees the platform can rely on every field being present.
 */
export function defineGame(input: GameDefinitionInput): GameDefinition {
  if (!SLUG_RE.test(input.slug)) throw new Error(`Invalid game slug "${input.slug}"`);
  const usesCamera = input.usesCamera ?? false;
  const usesMicrophone = input.usesMicrophone ?? false;
  return {
    id: input.slug,
    status: "live",
    supportsMobile: true,
    supportsDesktop: true,
    version: 1,
    leaderboardType: "score",
    scoreDirection: "higher",
    scoreFormat: "points",
    scoreUnit: "pts",
    // Camera / mic games are opt-in experiences; never force them on everyone as the daily.
    dailyEligible: !usesCamera && !usesMicrophone,
    ...input,
    usesCamera,
    usesMicrophone,
  };
}
