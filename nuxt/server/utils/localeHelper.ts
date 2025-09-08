import { getCookie } from 'h3';
import type { H3Event } from 'h3';

import en from '~~/i18n/locales/en.json';
import pl from '~~/i18n/locales/pl.json';

const locales: Record<string, Record<string, string>> = {
  en,
  pl,
};

/**
 * Get translated string based on the locale from cookie
 * @param event - The H3Event to read cookie from
 * @param key - The translation key
 * @param placeholders - Optional object with placeholder values to replace in the translation
 * @returns The translated string with placeholders replaced, or the key if not found
 */
export function getTranslatedString(event: H3Event, key: string, placeholders?: Record<string, string | number>): string {
  const locale = getCookie(event, 'i18n_detected') || 'en';
  const translations = locales[locale] || locales.en;
  let translated = translations[key] || key;

  if (placeholders) {
    for (const [placeholder, value] of Object.entries(placeholders)) {
      translated = translated.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value));
    }
  }

  return translated;
}
