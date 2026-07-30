'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { defaultLocale, type Locale } from '../lib/i18n/messages';

const LocaleContext = createContext<Locale>(defaultLocale);

export function LocaleProvider({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
