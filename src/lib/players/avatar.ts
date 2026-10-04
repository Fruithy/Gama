/**
 * Avatars are generated, never uploaded (no moderation burden, no PII):
 * `b<body>-c<colour>` picks a blob silhouette + colour from fixed sets.
 */
export const AVATAR_COLORS = ["#d4ff3a", "#ff3d7f", "#3dd8ff", "#ffc23d", "#8b5cff", "#3dffb0", "#ff6a3d", "#f5f5f7"];
export const AVATAR_BODIES = 6;

export function parseAvatar(id: string | null | undefined): { body: number; color: number } {
  const m = /^b(\d+)-c(\d+)$/.exec(id ?? "");
  if (!m) return { body: 0, color: 0 };
  return { body: Number(m[1]) % AVATAR_BODIES, color: Number(m[2]) % AVATAR_COLORS.length };
}

export function isValidAvatar(id: string): boolean {
  const m = /^b(\d+)-c(\d+)$/.exec(id);
  return !!m && Number(m[1]) < AVATAR_BODIES && Number(m[2]) < AVATAR_COLORS.length;
}

export function randomAvatar(random: () => number = Math.random): string {
  return `b${Math.floor(random() * AVATAR_BODIES)}-c${Math.floor(random() * AVATAR_COLORS.length)}`;
}

export const ALL_AVATARS: string[] = Array.from({ length: AVATAR_BODIES * AVATAR_COLORS.length }, (_, i) => `b${i % AVATAR_BODIES}-c${Math.floor(i / AVATAR_BODIES)}`);
