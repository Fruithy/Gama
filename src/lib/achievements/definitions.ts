/**
 * Achievement definitions as DATA. The evaluator interprets rules; no UI code
 * knows about individual achievements. Admins can toggle / re-price them
 * (stored in the `achievements` table, seeded from here).
 */

export type AchievementRule =
  | { type: "player_stat"; stat: PlayerStatKey; gte: number }
  | { type: "run_stat"; stat: string; gte: number }
  | { type: "run_score"; gte: number; format?: "points" | "count" }
  | { type: "rank"; board: "global" | "daily"; lte: number }
  | { type: "impossible_win" }
  | { type: "personal_best_count"; gte: number };

export type PlayerStatKey = "total_plays" | "games_played" | "daily_streak" | "challenge_wins" | "daily_wins" | "categories_played" | "level";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  tier: "bronze" | "silver" | "gold" | "legend";
  rule: AchievementRule;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-game", name: "First Game", description: "Finish your first run.", icon: "🎮", xp: 50, tier: "bronze", rule: { type: "player_stat", stat: "total_plays", gte: 1 } },
  { id: "plays-10", name: "Warming Up", description: "Play 10 games.", icon: "🔥", xp: 100, tier: "bronze", rule: { type: "player_stat", stat: "total_plays", gte: 10 } },
  { id: "plays-100", name: "One More Try", description: "Play 100 games.", icon: "💯", xp: 300, tier: "silver", rule: { type: "player_stat", stat: "total_plays", gte: 100 } },
  { id: "plays-1000", name: "Arcade Rat", description: "Play 1,000 games.", icon: "🐀", xp: 1000, tier: "gold", rule: { type: "player_stat", stat: "total_plays", gte: 1000 } },
  { id: "explorer-5", name: "Explorer", description: "Play 5 different games.", icon: "🧭", xp: 100, tier: "bronze", rule: { type: "player_stat", stat: "games_played", gte: 5 } },
  { id: "explorer-15", name: "Completionist", description: "Play 15 different games.", icon: "🗺️", xp: 250, tier: "silver", rule: { type: "player_stat", stat: "games_played", gte: 15 } },
  { id: "category-5", name: "Genre Hopper", description: "Play games from 5 categories.", icon: "🎲", xp: 150, tier: "bronze", rule: { type: "player_stat", stat: "categories_played", gte: 5 } },
  { id: "global-top-100", name: "Top 100", description: "Reach the global top 100 in any game.", icon: "🌍", xp: 300, tier: "silver", rule: { type: "rank", board: "global", lte: 100 } },
  { id: "global-top-10", name: "Top 10", description: "Reach the global top 10 in any game.", icon: "🏆", xp: 750, tier: "gold", rule: { type: "rank", board: "global", lte: 10 } },
  { id: "world-record", name: "World Record", description: "Hold #1 in the world in any game.", icon: "👑", xp: 2000, tier: "legend", rule: { type: "rank", board: "global", lte: 1 } },
  { id: "daily-1", name: "#1 Daily", description: "Top the Daily Challenge leaderboard.", icon: "📅", xp: 500, tier: "gold", rule: { type: "rank", board: "daily", lte: 1 } },
  { id: "streak-3", name: "Habit", description: "3-day daily streak.", icon: "📆", xp: 100, tier: "bronze", rule: { type: "player_stat", stat: "daily_streak", gte: 3 } },
  { id: "streak-10", name: "10 Day Streak", description: "10-day daily streak.", icon: "⚡", xp: 500, tier: "gold", rule: { type: "player_stat", stat: "daily_streak", gte: 10 } },
  { id: "perfect-10", name: "Perfect ×10", description: "Land 10 perfects in a single run.", icon: "✨", xp: 200, tier: "silver", rule: { type: "run_stat", stat: "perfects", gte: 10 } },
  { id: "score-100", name: "Triple Digits", description: "Score 100+ in a points game.", icon: "💥", xp: 150, tier: "bronze", rule: { type: "run_score", gte: 100, format: "count" } },
  { id: "impossible-win", name: "Impossible Win", description: "Hit the legendary mark in an Impossible game.", icon: "💀", xp: 1500, tier: "legend", rule: { type: "impossible_win" } },
  { id: "challenge-winner", name: "Challenge Winner", description: "Beat a friend's challenge.", icon: "🥊", xp: 150, tier: "bronze", rule: { type: "player_stat", stat: "challenge_wins", gte: 1 } },
  { id: "beat-10-friends", name: "Beat 10 Friends", description: "Win 10 friend challenges.", icon: "🤺", xp: 600, tier: "gold", rule: { type: "player_stat", stat: "challenge_wins", gte: 10 } },
  { id: "pb-25", name: "Always Improving", description: "Set 25 personal bests.", icon: "📈", xp: 250, tier: "silver", rule: { type: "personal_best_count", gte: 25 } },
];
