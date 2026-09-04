import { createContext, useContext, useEffect, useState } from 'react'

const PageHeaderContext = createContext(null)

export function PageHeaderProvider({ children }) {
  const [header, setHeader] = useState({ title: '', actions: null })
  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  )
}

/** Call from a page to set the topbar title and optional action buttons. */
export function usePageHeader(title, actions = null) {
  const ctx = useContext(PageHeaderContext)
  useEffect(() => {
    ctx.setHeader({ title, actions })
  }, [title, actions])
}

/** Used by the layout itself to read the current header. */
export function useCurrentHeader() {
  return useContext(PageHeaderContext).header
}
