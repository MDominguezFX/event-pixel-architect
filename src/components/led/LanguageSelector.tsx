import { useEffect, useState } from "react";
import { currentLocale, detectLocale, LANGUAGE_KEY, setLocale, type Locale } from "@/lib/i18n/core";
import { useLocale } from "@/lib/i18n/react";
import { Btn } from "./ui";

export function LanguageSelector() {
  const locale = useLocale();
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const select = async (next: Locale, persist: boolean) => {
    setPending(true); setFailed(false);
    try {
      await setLocale(next);
      document.documentElement.lang = currentLocale();
      if (persist) { try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Private browsing. */ } }
    } catch { setFailed(true); }
    finally { setPending(false); }
  };
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(LANGUAGE_KEY); } catch { /* Use browser preference. */ }
    void select(detectLocale(saved, navigator.languages), false);
  }, []);
  return <div className="flex rounded-md border border-border bg-muted p-0.5" role="group" aria-label="Language / Idioma" aria-busy={pending}>
    {([['es', 'ES', 'Español'], ['en', 'EN', 'English'], ['pt-BR', 'PT', 'Português brasileiro']] as const).map(([id, label, name]) =>
      <Btn key={id} variant={locale === id ? "default" : "ghost"} className="h-8 px-1.5 text-xs sm:px-2" title={failed ? `${name} · Retry / Reintentar` : name} aria-pressed={locale === id} disabled={pending} onClick={() => { void select(id, true); }}>{label}</Btn>)}
  </div>;
}