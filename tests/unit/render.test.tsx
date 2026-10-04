// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameCard } from "@/components/game/GameCard";
import { toCard } from "@/components/game/types";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";
import { ResultPanel } from "@/components/play/ResultPanel";
import { getGame } from "@/games/registry";
import { toSummary } from "@/games/registry";
import type { GameResult } from "@/games/core/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const stack = getGame("stack-up")!;
const result: GameResult = {
  score: 47,
  completed: true,
  metadata: { seed: "s", gameVersion: 1, durationMs: 30_000, actions: 50, peakActionsPerSecond: 3, checkpoints: [[29_000, 47]], stats: {}, input: { pointerDowns: 50, keyDowns: 0, rejectedMultiTouch: 0, rejectedFast: 0 } },
};
const noop = () => {};
afterEach(cleanup);

describe("game card", () => {
  it("renders name, category, difficulty, badges and links to the game page", () => {
    render(<GameCard game={{ ...toCard(stack), isNew: true }} plays={12_400} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/games/stack-up");
    expect(screen.getByText("Stack Up")).toBeTruthy();
    expect(screen.getByText(/Arcade/)).toBeTruthy();
    expect(screen.getByText("Medium")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText(/12\.4K/)).toBeTruthy();
    expect(link.querySelector("img")?.getAttribute("src")).toBe("/art/stack-up.svg");
  });
});

describe("leaderboard list", () => {
  it("renders medals, a gap row and highlights the current player", () => {
    const e = (rank: number, name: string, isMe = false) => ({ rank, playerId: name, username: name, avatar: "b1-c2", country: "NO", score: 100 - rank, achievedAt: new Date().toISOString(), isMe });
    render(<LeaderboardList rows={[e(1, "alpha"), e(2, "beta"), { gap: true, key: "g" }, e(842, "me", true)]} format="count" unit="" />);
    expect(screen.getByText("🥇")).toBeTruthy();
    expect(screen.getByLabelText("more players")).toBeTruthy();
    const mine = screen.getByText("#842").closest("li")!;
    expect(mine.getAttribute("aria-current")).toBe("true");
  });
});

describe("result screen", () => {
  it("leads with world rank and offers retry, challenge, share and top 100", () => {
    render(
      <ResultPanel
        game={toSummary(stack)}
        result={result}
        submit={{
          state: "done",
          response: {
            status: "accepted",
            runId: "00000000-0000-0000-0000-000000000001",
            score: 47,
            personalBest: { isNew: true, previous: 40, best: 47 },
            ranks: { global: { rank: 842, total: 120_000, tier: "top-1000", percentile: 99 }, country: { rank: 12, total: 900, tier: null, percentile: 98, code: "NO" }, today: { rank: 30, total: 4000, tier: null, percentile: 99 }, bestGlobal: 842 },
            nextTarget: { username: "beta", score: 48, rank: 841 },
            xp: { gained: 75, breakdown: [], total: 500, level: 4, levelUp: false, progress: 0.4 },
            achievements: [],
          },
        }}
        localBest={47}
        isLocalBest
        mode="normal"
        armed
        showRating={false}
        reducedMotion
        onRetry={noop}
        onExit={noop}
        onChallenge={noop}
        onShare={noop}
      />,
    );
    expect(screen.getByRole("heading").textContent).toContain("#842");
    expect(screen.getByText(/TOP 1000/)).toBeTruthy();
    expect(screen.getByText(/New personal best/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /challenge/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /top 100/i }).getAttribute("href")).toBe("/games/stack-up/leaderboard");
    expect(screen.getByText(/more to pass/)).toBeTruthy();
  });

  it("says YOU LOST BY N in challenge mode and is honest about offline scores", () => {
    const { unmount } = render(
      <ResultPanel
        game={toSummary(stack)}
        result={{ ...result, score: 44 }}
        submit={{ state: "done", response: { status: "accepted", runId: "x", score: 44, challenge: { won: false, tie: false, margin: 3, opponent: { username: "Fruithy", score: 47 } } } }}
        localBest={null}
        isLocalBest={false}
        mode="challenge"
        challengeTarget={{ username: "Fruithy", score: 47 }}
        armed
        showRating={false}
        reducedMotion
        onRetry={noop}
        onExit={noop}
        onChallenge={noop}
        onShare={noop}
      />,
    );
    expect(screen.getByRole("heading").textContent).toBe("YOU LOST BY 3");
    expect(screen.getByRole("button", { name: /rematch/i })).toBeTruthy();
    unmount();
    render(
      <ResultPanel game={toSummary(stack)} result={result} submit={{ state: "queued", message: "Score saved locally — leaderboard unavailable." }} localBest={null} isLocalBest={false} mode="normal" armed showRating={false} reducedMotion onRetry={noop} onExit={noop} onChallenge={noop} onShare={noop} />,
    );
    expect(screen.getByText(/Score saved locally — leaderboard unavailable/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /challenge/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
