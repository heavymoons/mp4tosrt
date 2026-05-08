import React, { createContext, useContext, useMemo } from 'react'
import { MESSAGES, type Locale, type LocaleKey } from './strings'

export type { Locale, LocaleKey } from './strings'

type Params = Record<string, string | number>
type TFn = (key: LocaleKey, params?: Params) => string

const I18nContext = createContext<{ locale: Locale; t: TFn }>({
  locale: 'en',
  t: key => key
})

function interpolate(s: string, params?: Params): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k]
    return v === undefined ? `{${k}}` : String(v)
  })
}

export function I18nProvider({
  locale,
  children
}: {
  locale: Locale
  children: React.ReactNode
}): JSX.Element {
  const value = useMemo(() => {
    const dict = MESSAGES[locale]
    const fallback = MESSAGES.en
    const t: TFn = (key, params) => {
      const raw = dict[key] ?? fallback[key] ?? key
      return interpolate(raw, params)
    }
    return { locale, t }
  }, [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): TFn {
  return useContext(I18nContext).t
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = (navigator.language || '').toLowerCase()
  return lang.startsWith('ja') ? 'ja' : 'en'
}
