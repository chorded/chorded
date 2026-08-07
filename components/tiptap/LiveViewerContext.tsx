import React, { createContext, useContext, ReactNode } from 'react'

interface LiveViewerContextType {
  nashville: boolean
  songKey: string
}

const LiveViewerContext = createContext<LiveViewerContextType>({ nashville: false, songKey: 'C' })

export const LiveViewerProvider: React.FC<{ children: ReactNode, nashville: boolean, songKey: string }> = ({ children, nashville, songKey }) => {
  return (
    <LiveViewerContext.Provider value={{ nashville, songKey }}>
      {children}
    </LiveViewerContext.Provider>
  )
}

export const useLiveViewer = () => useContext(LiveViewerContext)
