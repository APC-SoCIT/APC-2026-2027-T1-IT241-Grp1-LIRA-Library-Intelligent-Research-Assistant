import { FiExternalLink, FiMaximize, FiMinimize, FiX } from 'react-icons/fi'
import { useState } from 'react'

function getReadingUrl(book) {
  const value = book.url || book.online
  if (!value || value === 'No digital copy available') return null
  return value.split('|')[0].trim()
}

export default function EbookReader({ book, onClose }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const readingUrl = getReadingUrl(book)

  if (!readingUrl) return null

  return (
    <div className={`ebook-reader ${isFullscreen ? 'ebook-reader-fullscreen' : ''}`} role="dialog" aria-modal="true" aria-label={`Reading ${book.title}`}>
      <header className="ebook-reader-toolbar">
        <div className="ebook-reader-heading">
          <strong>{book.title}</strong>
          <span>{book.author}</span>
        </div>
        <div className="ebook-reader-actions">
          <a href={readingUrl} target="_blank" rel="noreferrer" title="Open book in a new tab" aria-label="Open book in a new tab">
            <FiExternalLink />
          </a>
          <button type="button" onClick={() => setIsFullscreen((value) => !value)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <FiMinimize /> : <FiMaximize />}
          </button>
          <button type="button" onClick={onClose} title="Close reader" aria-label="Close reader"><FiX /></button>
        </div>
      </header>
      <iframe className="ebook-reader-frame" src={readingUrl} title={`Contents of ${book.title}`} />
    </div>
  )
}
