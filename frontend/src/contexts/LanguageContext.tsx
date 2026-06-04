import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { TRANSLATIONS, type Lang, type T } from '../i18n'

interface LanguageCtx {
  lang:   Lang
  t:      T
  toggle: () => void
}

const LanguageContext = createContext<LanguageCtx>({
  lang:   'en',
  t:      TRANSLATIONS.en,
  toggle: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('wc-lang')
    return (saved === 'zh' ? 'zh' : 'en') as Lang
  })

  useEffect(() => {
    localStorage.setItem('wc-lang', lang)
    // Set html lang attribute for accessibility
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  function toggle() {
    setLang(l => l === 'en' ? 'zh' : 'en')
  }

  return (
    <LanguageContext.Provider value={{ lang, t: TRANSLATIONS[lang], toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
