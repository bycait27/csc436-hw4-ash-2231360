import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CsvUploader } from './components/CsvUploader'
import { RecordsExplorer } from './components/RecordsExplorer'
import { useState } from 'react'
import { ApiRecordsExplorer } from './components/ApiRecordsExplorer'
import type { ParsedCsv } from './lib/parseCsv'
import {
  downloadAnalysis,
  type AnalysisExport,
} from './lib/analysisExport'
import './app.css'

export function App() {
  const [mode, setMode] = useState<'api' | 'csv'>('api')
  const [dataset, setDataset] = useState<
    (ParsedCsv & {
      fileName: string
      acceptedCount: number
      rejectedCount: number
      loadId: number
    }) | null
  >(null)
  const [analysis, setAnalysis] = useState<AnalysisExport | null>(null)

  return (
    <>
      <header className="app-header">
        <div className="app-header__brand">
          <h1>Evidence before action</h1>
          <p>Campus service review / synthetic coursework data</p>
        </div>
        <button
          className="app-header__download"
          type="button"
          onClick={() => {
            if (analysis) downloadAnalysis(analysis)
          }}
          disabled={analysis === null}
        >
          Download analysis
        </button>
      </header>
      <main className="app-main">
        <nav className="app-mode-switch" aria-label="Data source">
          <button type="button" aria-pressed={mode === 'api'} onClick={() => setMode('api')}>
            API mode
          </button>
          <button type="button" aria-pressed={mode === 'csv'} onClick={() => setMode('csv')}>
            Local CSV mode
          </button>
        </nav>
        {mode === 'api' ? (
          <ApiRecordsExplorer />
        ) : (
          <>
            <CsvUploader
              onDatasetLoaded={(loadedDataset) =>
                setDataset((currentDataset) => ({
                  ...loadedDataset,
                  loadId: (currentDataset?.loadId ?? 0) + 1,
                }))
              }
            />
            <RecordsExplorer
              key={dataset?.loadId ?? 0}
              dataset={dataset}
              onAnalysisChange={setAnalysis}
            />
          </>
        )}
      </main>
    </>
  )
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Could not find the app root element.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
