/** Test double for `next/headers` (aliased in vitest.config.ts). */
export const cookieJar = new Map<string, string>();
export const headerBag = new Headers();

export async function cookies() {
  return {
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  };
}

export async function headers() {
  return headerBag;
}
