/**
 * Original programmatic faces (no emoji fonts, no third-party art) so the game
 * looks identical on every device and in share cards.
 */
export const FACES = ["happy", "sad", "wink", "shock", "cool", "angry", "love", "sleepy", "tongue", "grin", "meh", "dizzy"] as const;
export type Face = (typeof FACES)[number];

/** Pairs that look alike — mixed in later to raise difficulty. */
export const LOOKALIKES: Record<Face, Face> = {
  happy: "grin", grin: "happy", sad: "meh", meh: "sad", wink: "tongue", tongue: "wink",
  shock: "dizzy", dizzy: "shock", cool: "angry", angry: "cool", love: "happy", sleepy: "meh",
};

export function drawFace(g: CanvasRenderingContext2D, face: Face, x: number, y: number, r: number) {
  g.save();
  g.translate(x, y);
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.beginPath();
  g.arc(r * 0.06, r * 0.1, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = face === "angry" ? "#ff7a3d" : face === "love" ? "#ffb0c8" : "#ffd23d";
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#0b0b0f";
  g.lineWidth = Math.max(2, r * 0.08);
  g.stroke();
  const ink = "#0b0b0f";
  const lw = Math.max(2, r * 0.1);
  g.lineWidth = lw;
  g.lineCap = "round";
  g.strokeStyle = ink;
  g.fillStyle = ink;
  const ex = r * 0.36;
  const ey = -r * 0.18;
  const dot = (dx: number) => {
    g.beginPath();
    g.arc(dx, ey, r * 0.11, 0, Math.PI * 2);
    g.fill();
  };
  const arc = (cx: number, cy: number, rr: number, a0: number, a1: number) => {
    g.beginPath();
    g.arc(cx, cy, rr, a0, a1);
    g.stroke();
  };
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  switch (face) {
    case "happy":
      dot(-ex); dot(ex); arc(0, r * 0.05, r * 0.45, 0.2 * Math.PI, 0.8 * Math.PI); break;
    case "grin":
      dot(-ex); dot(ex);
      g.beginPath(); g.moveTo(-r * 0.5, r * 0.15); g.quadraticCurveTo(0, r * 0.85, r * 0.5, r * 0.15); g.closePath(); g.fill(); break;
    case "sad":
      dot(-ex); dot(ex); arc(0, r * 0.75, r * 0.4, 1.2 * Math.PI, 1.8 * Math.PI); break;
    case "meh":
      dot(-ex); dot(ex); seg(-r * 0.35, r * 0.42, r * 0.35, r * 0.42); break;
    case "wink":
      dot(-ex); arc(ex, ey + r * 0.05, r * 0.14, 1.1 * Math.PI, 1.9 * Math.PI); arc(0, r * 0.05, r * 0.45, 0.2 * Math.PI, 0.8 * Math.PI); break;
    case "tongue":
      dot(-ex); arc(ex, ey + r * 0.05, r * 0.14, 1.1 * Math.PI, 1.9 * Math.PI); seg(-r * 0.35, r * 0.35, r * 0.35, r * 0.35);
      g.fillStyle = "#ff3d7f"; g.beginPath(); g.ellipse(r * 0.08, r * 0.52, r * 0.16, r * 0.2, 0, 0, Math.PI * 2); g.fill(); break;
    case "shock":
      dot(-ex); dot(ex); g.beginPath(); g.ellipse(0, r * 0.42, r * 0.16, r * 0.22, 0, 0, Math.PI * 2); g.fill(); break;
    case "dizzy":
      seg(-ex - r * 0.1, ey - r * 0.1, -ex + r * 0.1, ey + r * 0.1); seg(-ex + r * 0.1, ey - r * 0.1, -ex - r * 0.1, ey + r * 0.1);
      seg(ex - r * 0.1, ey - r * 0.1, ex + r * 0.1, ey + r * 0.1); seg(ex + r * 0.1, ey - r * 0.1, ex - r * 0.1, ey + r * 0.1);
      g.beginPath(); g.ellipse(0, r * 0.42, r * 0.14, r * 0.18, 0, 0, Math.PI * 2); g.fill(); break;
    case "cool":
      g.fillRect(-r * 0.62, ey - r * 0.14, r * 0.5, r * 0.3); g.fillRect(r * 0.12, ey - r * 0.14, r * 0.5, r * 0.3); seg(-r * 0.12, ey, r * 0.12, ey);
      arc(0, r * 0.12, r * 0.35, 0.25 * Math.PI, 0.75 * Math.PI); break;
    case "angry":
      seg(-ex - r * 0.18, ey - r * 0.22, -ex + r * 0.15, ey - r * 0.08); seg(ex + r * 0.18, ey - r * 0.22, ex - r * 0.15, ey - r * 0.08);
      dot(-ex); dot(ex); arc(0, r * 0.75, r * 0.38, 1.25 * Math.PI, 1.75 * Math.PI); break;
    case "love":
      for (const s of [-1, 1]) {
        const hx = s * ex;
        g.fillStyle = "#ff3d7f";
        g.beginPath();
        g.moveTo(hx, ey + r * 0.14);
        g.bezierCurveTo(hx - r * 0.3, ey - r * 0.1, hx - r * 0.1, ey - r * 0.32, hx, ey - r * 0.12);
        g.bezierCurveTo(hx + r * 0.1, ey - r * 0.32, hx + r * 0.3, ey - r * 0.1, hx, ey + r * 0.14);
        g.fill();
      }
      g.strokeStyle = ink; arc(0, r * 0.05, r * 0.42, 0.2 * Math.PI, 0.8 * Math.PI); break;
    case "sleepy":
      arc(-ex, ey, r * 0.13, 0.1 * Math.PI, 0.9 * Math.PI); arc(ex, ey, r * 0.13, 0.1 * Math.PI, 0.9 * Math.PI);
      g.beginPath(); g.ellipse(0, r * 0.45, r * 0.1, r * 0.08, 0, 0, Math.PI * 2); g.fill(); break;
  }
  g.restore();
}
