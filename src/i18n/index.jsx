// Tiny translation layer: English is the source text and the key; Urdu comes from ./ur.js.
// t('Due in {n}m', { n: 5 }) → "Due in 5m" or the Urdu sentence. Only what people *read* is
// translated — values sent to the server (statuses, priorities, reasons) stay in English.
import { createContext, useContext, useEffect, useState, Fragment } from 'react'
import ur from './ur'

const KEY = 'tm_lang'
let current = (() => {
  try {
    return localStorage.getItem(KEY) === 'ur' ? 'ur' : 'en'
  } catch {
    return 'en'
  }
})()

export function t(text, vars) {
  let out = current === 'ur' ? ur[text] ?? text : text
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString())
  return out
}
export const getLang = () => current

const LangContext = createContext({ lang: 'en', setLang: () => {} })
export const useLang = () => useContext(LangContext)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(current)
  const setLang = (l) => {
    current = l === 'ur' ? 'ur' : 'en'
    try { localStorage.setItem(KEY, current) } catch { /* private mode: this visit only */ }
    setLangState(current)
  }
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  // Re-mount the app on switch so every t() call re-reads the language (a switch is rare).
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  )
}
