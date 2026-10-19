export type Locale = "es" | "en" | "pt-BR";
export type Dictionary = Record<string, string>;
export const LANGUAGE_KEY = "mansso.language";
const loaders = {
  es: () => import("./locales/es.json"),
  en: () => import("./locales/en.json"),
  "pt-BR": () => import("./locales/pt-BR.json"),
};
let locale: Locale = "es";
let dictionary: Dictionary = {};
let patterns: { regex: RegExp; value: string; indexes: number[] }[] = [];
let revision = 0;
const listeners = new Set<() => void>();
export const subscribeLocale = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const currentLocale = () => locale;
export function detectLocale(saved: string | null, languages: readonly string[]): Locale {
  if (saved === "es" || saved === "en" || saved === "pt-BR") return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "es" || base === "en") return base;
    if (base === "pt") return "pt-BR";
  }
  return "es";
}
export async function setLocale(next: Locale) {
  const request = ++revision;
  const loaded = await loaders[next]();
  if (request !== revision) return;
  dictionary = loaded.default;
  patterns = Object.entries(dictionary).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
    const indexes: number[] = [];
    let source = "", last = 0;
    for (const match of key.matchAll(/\{(\d+)\}/g)) {
      source += key.slice(last, match.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([\\s\\S]*?)";
      indexes.push(Number(match[1])); last = match.index + match[0].length;
    }
    source += key.slice(last).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { regex: new RegExp("^" + source + "$"), value, indexes };
  });
  locale = next;
  listeners.forEach((listener) => listener());
}
/** Only complete known messages match; captured names and technical values remain unchanged. */
export function t(source: string): string {
  if (locale === "es") return source;
  if (Object.hasOwn(dictionary, source)) return dictionary[source] ?? source;
  for (const pattern of patterns) {
    const match = pattern.regex.exec(source);
    if (!match) continue;
    return pattern.value.replace(/\{(\d+)\}/g, (token, index: string) => {
      const capture = pattern.indexes.indexOf(Number(index));
      return capture >= 0 ? match[capture + 1] ?? token : token;
    });
  }
  return source;
}
export function translateValue<T>(value: T): T | string {
  return typeof value === "string" ? t(value) : value;
}