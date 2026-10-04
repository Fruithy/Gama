/**
 * Country handling. We only ever store an ISO 3166-1 alpha-2 code — never IP
 * addresses or precise location. Detection uses the CDN's country header once
 * at profile creation; players can change it in settings.
 */

// prettier-ignore
export const COUNTRY_CODES = ["AD","AE","AF","AG","AL","AM","AO","AR","AT","AU","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BN","BO","BR","BS","BT","BW","BY","BZ","CA","CD","CF","CG","CH","CI","CL","CM","CN","CO","CR","CU","CV","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","ER","ES","ET","FI","FJ","FM","FR","GA","GB","GD","GE","GH","GM","GN","GQ","GR","GT","GW","GY","HK","HN","HR","HT","HU","ID","IE","IL","IN","IQ","IR","IS","IT","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MG","MH","MK","ML","MM","MN","MO","MR","MT","MU","MV","MW","MX","MY","MZ","NA","NE","NG","NI","NL","NO","NP","NR","NZ","OM","PA","PE","PG","PH","PK","PL","PR","PS","PT","PW","PY","QA","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SI","SK","SL","SM","SN","SO","SR","SS","ST","SV","SY","SZ","TD","TG","TH","TJ","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","US","UY","UZ","VA","VC","VE","VN","VU","WS","XK","YE","ZA","ZM","ZW"];

const VALID = new Set(COUNTRY_CODES);

export function isValidCountry(code: string | null | undefined): code is string {
  return !!code && VALID.has(code.toUpperCase());
}

export function normalizeCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return VALID.has(c) ? c : null;
}

/** Flag emoji from regional indicator symbols. */
export function flagEmoji(code: string | null | undefined): string {
  const c = normalizeCountry(code);
  if (!c) return "🏳️";
  return String.fromCodePoint(...c.split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

let names: Intl.DisplayNames | null = null;
export function countryName(code: string | null | undefined): string {
  const c = normalizeCountry(code);
  if (!c) return "Unknown";
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(c) ?? c;
  } catch {
    return c;
  }
}

/** Country from trusted edge headers (Vercel / Cloudflare / custom). */
export function countryFromHeaders(h: Headers): string | null {
  return normalizeCountry(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country-code"));
}
