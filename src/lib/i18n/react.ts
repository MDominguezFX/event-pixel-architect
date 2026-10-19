import { useSyncExternalStore } from "react";
import { currentLocale, subscribeLocale } from "./core";
export { t, translateValue } from "./core";
export const useLocale = () => useSyncExternalStore(subscribeLocale, currentLocale, () => "es" as const);