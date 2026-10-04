/**
 * Username rules — shared by the client form (instant feedback) and the
 * server (authoritative). Usernames are unique case-insensitively.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** Claimed usernames can be changed once per this many days. */
export const USERNAME_CHANGE_COOLDOWN_DAYS = 7;

const ALLOWED = /^[A-Za-z][A-Za-z0-9_]*$/;

export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "help", "moderator", "mod", "staff", "official",
  "filterarcade", "filter_arcade", "arcade", "api", "games", "game", "daily", "challenge", "records", "settings",
  "profile", "me", "you", "user", "users", "player", "guest", "anonymous", "anon", "null", "undefined",
  "login", "logout", "signup", "signin", "auth", "privacy", "terms", "security", "billing", "team", "dev",
  "tiktok", "snapchat", "instagram", "meta", "google", "apple", "everyone", "here", "worldrecord",
]);

// Kept intentionally short & generic; matched after leetspeak normalisation.
const BLOCKED_FRAGMENTS = [
  "fuck", "shit", "cunt", "bitch", "nigg", "fagg", "retard", "whore", "slut", "rape", "nazi", "hitler",
  "dick", "cock", "pussy", "porn", "anal", "penis", "vagina", "kkk", "isis", "pedo", "molest", "twat", "wank",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", $: "s", "!": "i" };

/**
 * Lowercase, de-leet and strip separators. Digits/symbols are only read as
 * letters when they sit *inside* a word ("sh1t" → "shit"); trailing number
 * blocks like "Raven2199" are dropped so they can't form false positives.
 */
export function normalizeForFilter(name: string): string {
  const chars = name.toLowerCase().split("");
  const isLetter = (c: string | undefined) => !!c && /[a-z]/.test(c);
  return chars
    .map((c, i) => (LEET[c] && isLetter(chars[i - 1]) && (isLetter(chars[i + 1]) || LEET[chars[i + 1] ?? ""]) ? LEET[c] : c))
    .join("")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

export function containsProfanity(name: string): boolean {
  const n = normalizeForFilter(name);
  return BLOCKED_FRAGMENTS.some((f) => n.includes(f));
}

export type UsernameError = "too_short" | "too_long" | "invalid_chars" | "reserved" | "profanity" | "double_underscore";

export function validateUsername(raw: string): { ok: true; username: string } | { ok: false; error: UsernameError; message: string } {
  const username = raw.trim();
  if (username.length < USERNAME_MIN) return { ok: false, error: "too_short", message: `At least ${USERNAME_MIN} characters.` };
  if (username.length > USERNAME_MAX) return { ok: false, error: "too_long", message: `At most ${USERNAME_MAX} characters.` };
  if (!ALLOWED.test(username)) return { ok: false, error: "invalid_chars", message: "Letters, numbers and _ only. Start with a letter." };
  if (username.includes("__")) return { ok: false, error: "double_underscore", message: "No double underscores." };
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return { ok: false, error: "reserved", message: "That name is reserved." };
  if (containsProfanity(username)) return { ok: false, error: "profanity", message: "Pick something else." };
  return { ok: true, username };
}

const ADJ = ["Swift", "Neon", "Turbo", "Lucky", "Sly", "Hyper", "Cosmic", "Pixel", "Quiet", "Wild", "Rapid", "Fuzzy", "Silent", "Mega", "Tiny", "Brave", "Zesty", "Atomic", "Sneaky", "Golden"];
const NOUN = ["Otter", "Comet", "Panda", "Falcon", "Mango", "Yeti", "Rocket", "Gecko", "Wombat", "Pickle", "Lynx", "Narwhal", "Taco", "Badger", "Kiwi", "Raven", "Noodle", "Moth", "Puffin", "Biscuit"];

/** Generated guest handle, e.g. "NeonOtter4821". Always passes validateUsername. */
export function generateUsername(random: () => number = Math.random): string {
  const a = ADJ[Math.floor(random() * ADJ.length)];
  const n = NOUN[Math.floor(random() * NOUN.length)];
  const num = Math.floor(random() * 9000) + 1000;
  return `${a}${n}${num}`;
}
