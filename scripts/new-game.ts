/**
 * Scaffold a new game in seconds:
 *
 *   npm run new-game -- my-game "My Game" reaction
 *
 * Creates src/games/<slug>/{meta,game,art}.ts from a working template and
 * registers it in src/games/registry.ts. Then: `npm run dev` → /games/<slug>.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [slug, nameArg, category = "arcade"] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('usage: npm run new-game -- <slug> "<Name>" [category]');
  process.exit(1);
}
const name = nameArg ?? slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const dir = path.join("src", "games", slug);
if (existsSync(dir)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const camel = slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const Pascal = camel[0].toUpperCase() + camel.slice(1);

writeFileSync(
  path.join(dir, "meta.ts"),
  `import { defineGame } from "../core/define";

/** All tuning numbers live here (shared by gameplay + validation). */
export const BALANCE = {
  durationS: 20,
  targetRadius: 40,
};

export default defineGame({
  slug: "${slug}",
  name: "${name}",
  shortDescription: "One line that sells it.",
  instructions: "Tap the target before time runs out.",
  category: "${category}" as const,
  difficulty: "medium",
  controls: ["tap"],
  estimatedDuration: BALANCE.durationS,
  scoreUnit: "pts",
  isNew: true,
  theme: { bg: ["#101030", "#3d3dd6"], accent: "#d4ff3a", ink: "#ffffff" },
  validation: {
    minDurationMs: 1_000,
    maxDurationMs: 5 * 60_000,
    maxScore: 500,
    maxScorePerSecond: 6,
    maxActionsPerSecond: 12,
    maxScorePerAction: 1,
    monotonicCheckpoints: true,
  },
  milestones: { good: 20, great: 40, legendary: 70 },
  load: () => import("./game"),
  art: () => import("./art"),
});
`,
);

writeFileSync(
  path.join(dir, "game.ts"),
  `import { CanvasGame, type PointerInfo } from "../core/engine";
import { blobCritter } from "../core/draw";
import { PALETTE } from "../core/fx";
import type { GameFactory, HudState } from "../core/types";
import { BALANCE as B } from "./meta";

class ${Pascal} extends CanvasGame {
  private tx = 200;
  private ty = 300;
  private timeLeft = B.durationS;

  protected setup() {
    this.timeLeft = B.durationS;
    this.moveTarget();
  }

  private moveTarget() {
    this.tx = this.rng.range(60, this.w - 60);
    this.ty = this.rng.range(this.h * 0.25, this.h * 0.85);
  }

  protected onPointerDown(p: PointerInfo) {
    if (Math.hypot(p.x - this.tx, p.y - this.ty) > B.targetRadius) return;
    this.addScore(1);
    this.juiceHit(this.tx, this.ty, PALETTE.volt, "+1");
    this.sound("pop");
    this.moveTarget();
  }

  protected update(dt: number) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.finish({ reason: "TIME!", slowMo: false });
  }

  protected render(g: CanvasRenderingContext2D) {
    blobCritter(g, this.tx, this.ty, B.targetRadius, PALETTE.volt, { mouth: "o" });
  }

  protected hud(): HudState {
    return { score: this.score, timeLeft: Math.max(0, this.timeLeft) };
  }
}

const factory: GameFactory = (def) => new ${Pascal}(def);
export default factory;
`,
);

writeFileSync(
  path.join(dir, "art.ts"),
  `import { critter, frame, label, sparkle } from "../core/art-kit";

export default frame(
  ["#101030", "#3d3dd6"],
  \`\${critter(200, 210, 90, "#d4ff3a", { mouth: "grin" })}
\${label("${name.toUpperCase().slice(0, 10)}", 200, 360, 34, "#fff")}
\${sparkle(330, 70, 16)}\`,
  { rays: true },
);
`,
);

const registryPath = path.join("src", "games", "registry.ts");
let reg = readFileSync(registryPath, "utf8");
reg = reg.replace(/(import \w+ from "\.\/[a-z0-9-]+\/meta";\n)(?![\s\S]*import \w+ from "\.\/[a-z0-9-]+\/meta";)/, `$1import ${camel} from "./${slug}/meta";\n`);
reg = reg.replace(/\n\];\n/, `\n  ${camel},\n];\n`);
writeFileSync(registryPath, reg);
console.log(`✔ Created ${dir} and registered "${name}". Open http://localhost:3000/games/${slug}`);
