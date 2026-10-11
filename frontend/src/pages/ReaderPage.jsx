import {
  FiArrowLeft, FiBookOpen, FiChevronLeft, FiChevronRight,
  FiChevronsLeft, FiChevronsRight, FiExternalLink, FiMaximize,
  FiMinimize, FiSearch, FiList, FiBookmark, FiZoomIn, FiZoomOut,
  FiVolume2, FiVolumeX, FiPlay, FiPause, FiSquare, FiMonitor
} from 'react-icons/fi'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReadingListPicker from '../components/ReadingListPicker'
import { getCatalogBook, getCatalogBookContent } from '../services/catalogService'
import { listBookmarks, recordCatalogBookView, recordReading, removeBookmark } from '../services/studentLibraryService'
import { adaptCatalogBook } from '../utils/catalogCategories'

function getReadingUrl(book) {
  const value = book?.url || book?.online
  if (!value || value === 'No digital copy available') return null
  return value.split('|')[0].trim()
}

function parseBookElements(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return [...doc.body.querySelectorAll('h1, h2, h3, h4, p, blockquote, pre, li, img')]
    .map((element) => {
      const tag = element.tagName.toLowerCase()
      if (tag === 'img') {
        let src = element.getAttribute('src') || ''
        if (src && baseUrl) {
          try { src = new URL(src, baseUrl).href } catch (e) { /* ignore */ }
        }
        return { tag, src, alt: element.getAttribute('alt') || '' }
      }
      return { tag, text: element.textContent?.trim() || '' }
    })
    .filter((el) => (el.tag === 'img' && el.src) || (el.text?.length > 0))
}

function getVoiceKey(voice) {
  return voice.voiceURI || voice.name
}

function voiceQualityScore(voice) {
  let score = voice.default ? 1 : 0
  if (/(natural|neural|premium|enhanced)/i.test(voice.name)) score += 5
  if (/(google|microsoft|apple|siri)/i.test(voice.name)) score += 2
  return score
}

function getLanguageLabel(language) {
  try {
    const displayName = new Intl.DisplayNames([navigator.language], { type: 'language' }).of(language)
    return displayName ? `${displayName} (${language})` : language
  } catch {
    return language
  }
}

// --- Text-to-Speech Hook ---
function useTTS() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('lira_tts_voice') || '')
  const [selectedLanguage, setSelectedLanguage] = useState('all')
  const [rate, setRate] = useState(() => Number(localStorage.getItem('lira_tts_rate')) || 1)
  const [pitch, setPitch] = useState(() => Number(localStorage.getItem('lira_tts_pitch')) || 1)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const utteranceRef = useRef(null)

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices().sort((left, right) =>
        voiceQualityScore(right) - voiceQualityScore(left)
        || left.name.localeCompare(right.name),
      )
      setVoices(available)
      setSelectedVoice((current) => available.some((voice) => getVoiceKey(voice) === current)
        ? current
        : getVoiceKey(available.find((voice) => voice.lang.toLowerCase().startsWith(navigator.language.toLowerCase())) || available[0] || { name: '' }))
      setSelectedLanguage((current) => current !== 'all'
        ? current
        : available.find((voice) => voice.lang.toLowerCase().startsWith(navigator.language.toLowerCase()))?.lang || 'all')
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.onvoiceschanged = null
      window.speechSynthesis.cancel()
    }
  }, [])

  const availableLanguages = [...new Set(voices.map((voice) => voice.lang).filter(Boolean))]
  const filteredVoices = voices.filter((voice) => selectedLanguage === 'all' || voice.lang === selectedLanguage)

  useEffect(() => {
    if (selectedVoice && filteredVoices.some((voice) => getVoiceKey(voice) === selectedVoice)) return
    setSelectedVoice(getVoiceKey(filteredVoices[0] || { name: '' }))
  }, [filteredVoices, selectedVoice])

  useEffect(() => {
    localStorage.setItem('lira_tts_voice', selectedVoice)
    localStorage.setItem('lira_tts_rate', String(rate))
    localStorage.setItem('lira_tts_pitch', String(pitch))
  }, [selectedVoice, rate, pitch])

  const speak = useCallback((text) => {
    window.speechSynthesis.cancel()
    if (!text) return
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = voices.find((candidate) => getVoiceKey(candidate) === selectedVoice)
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || (selectedLanguage === 'all' ? navigator.language : selectedLanguage)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = 1
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return
      setIsSpeaking(false)
      setIsPaused(false)
    }
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return
      setIsSpeaking(false)
      setIsPaused(false)
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
    setIsPaused(false)
  }, [voices, selectedVoice, selectedLanguage, rate, pitch])

  const previewVoice = useCallback(() => {
    speak('This is a preview of the selected reading voice. You can adjust the speed and pitch to suit your listening preference.')
  }, [speak])

  const pause = useCallback(() => {
    window.speechSynthesis.pause()
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    window.speechSynthesis.resume()
    setIsPaused(false)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    utteranceRef.current = null
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  return {
    voices,
    filteredVoices,
    availableLanguages,
    selectedVoice,
    setSelectedVoice,
    selectedLanguage,
    setSelectedLanguage,
    rate,
    setRate,
    pitch,
    setPitch,
    isSpeaking,
    isPaused,
    speak,
    previewVoice,
    pause,
    resume,
    stop,
  }
}

export default function ReaderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [parsedElements, setParsedElements] = useState(null)
  const [pages, setPages] = useState([])
  const [pageIndex, setPageIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState('')
  const [activityError, setActivityError] = useState('')
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [showListPicker, setShowListPicker] = useState(false)
  const [bookmarkMessage, setBookmarkMessage] = useState('')
  const [viewMode, setViewMode] = useState('book') // 'book' or 'scroll'
  const [fontSize, setFontSize] = useState(16)
  const [bookHeight, setBookHeight] = useState(85) // vh
  const [bookSize, setBookSize] = useState('medium') // 'medium', 'large', 'full'
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTOC, setShowTOC] = useState(false)
  const [showTTS, setShowTTS] = useState(false)
  const [flipDirection, setFlipDirection] = useState(null)
  const [isFlipping, setIsFlipping] = useState(false)
  const measureContainerRef = useRef(null)
  const searchInputRef = useRef(null)
  const prevProgressRef = useRef(0)

  const tts = useTTS()

  useEffect(() => {
    getCatalogBook(bookId)
      .then((record) => setBook(adaptCatalogBook(record)))
      .catch((requestError) => setError(requestError.message || 'Could not load this book.'))
  }, [bookId])

  useEffect(() => {
    let active = true
    listBookmarks()
      .then((bookmarks) => {
        if (active) setIsBookmarked(bookmarks.some((bookmark) => String(bookmark.book_id) === String(bookId)))
      })
      .catch(() => {})
    return () => { active = false }
  }, [bookId])

  const handleBookmark = async () => {
    if (!book || isBookmarking) return
    setIsBookmarking(true)
    setBookmarkMessage('')
    try {
      if (isBookmarked) {
        await removeBookmark(book.id)
        setIsBookmarked(false)
        setBookmarkMessage('Removed from your lists.')
      } else {
        setShowListPicker(true)
      }
    } catch (bookmarkError) {
      setBookmarkMessage(bookmarkError.message || 'Could not update your list.')
    } finally {
      setIsBookmarking(false)
    }
  }

  const readingUrl = getReadingUrl(book)

  useEffect(() => {
    if (!readingUrl) return undefined
    let active = true
    getCatalogBookContent(bookId)
      .then(async ({ content, resolvedUrl }) => {
        if (!active) return
        setParsedElements(parseBookElements(content, resolvedUrl || readingUrl))
        if (book) {
          const activityResults = await Promise.allSettled([
            recordCatalogBookView(book),
            recordReading(book),
          ])
          const failedActivity = activityResults.find((result) => result.status === 'rejected')
          if (failedActivity && active) {
            setActivityError('Your book opened, but reading history could not be saved.')
            console.error('Could not save reading activity:', failedActivity.reason)
          }
        }
      })
      .catch((requestError) => {
        if (active) setError('The book content could not be loaded in the page-turn reader. Use the new-tab button to open it directly.')
        console.error('Could not load book content:', requestError)
      })
    return () => { active = false }
  }, [readingUrl, bookId, book])

  // DOM-based pagination: measure real pixel heights
  useEffect(() => {
    if (!parsedElements || parsedElements.length === 0 || !measureContainerRef.current) return
    const container = measureContainerRef.current

    const measureAndPaginate = () => {
      const rect = container.getBoundingClientRect()
      const style = window.getComputedStyle(container)
      const paddingTop = parseFloat(style.paddingTop) || 0
      const paddingBottom = parseFloat(style.paddingBottom) || 0
      const paddingLeft = parseFloat(style.paddingLeft) || 0
      const paddingRight = parseFloat(style.paddingRight) || 0
      const availableHeight = rect.height - paddingTop - paddingBottom - 30
      const availableWidth = rect.width - paddingLeft - paddingRight

      if (availableHeight <= 50 || availableWidth <= 50) return

      const measurer = document.createElement('div')
      measurer.style.cssText = `
        position: fixed; top: -99999px; left: -99999px;
        width: ${availableWidth}px;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: ${fontSize}px;
        line-height: 1.72;
        visibility: hidden;
        pointer-events: none;
      `
      document.body.appendChild(measurer)

      const maxImgHeight = Math.floor(availableHeight * 0.85)
      const heights = []

      for (const block of parsedElements) {
        let el
        if (block.tag === 'img') {
          el = document.createElement('img')
          el.src = block.src
          el.alt = block.alt || ''
          el.style.cssText = `max-width:100%; max-height:${maxImgHeight}px; object-fit:contain; display:block; margin:1rem auto;`
        } else {
          const tagName = ['h1', 'h2', 'h3', 'h4'].includes(block.tag) ? block.tag : 'p'
          el = document.createElement(tagName)
          el.textContent = block.text
          if (['h1', 'h2', 'h3', 'h4'].includes(block.tag)) {
            el.style.cssText = 'margin:0 0 1rem; line-height:1.25; font-weight:700;'
            if (block.tag === 'h1') el.style.fontSize = '1.5em'
            else if (block.tag === 'h2') el.style.fontSize = '1.3em'
            else if (block.tag === 'h3') el.style.fontSize = '1.15em'
          } else {
            el.style.cssText = 'margin:0 0 0.9rem; text-align:justify; hyphens:auto;'
          }
        }
        measurer.appendChild(el)
        heights.push(el.getBoundingClientRect().height)
        measurer.removeChild(el)
      }

      document.body.removeChild(measurer)

      const result = []
      let currentPage = []
      let currentHeight = 0

      for (let i = 0; i < parsedElements.length; i++) {
        const h = heights[i]
        if (h >= availableHeight) {
          if (currentPage.length > 0) {
            result.push(currentPage)
            currentPage = []
            currentHeight = 0
          }
          result.push([parsedElements[i]])
          continue
        }
        if (currentHeight + h > availableHeight && currentPage.length > 0) {
          result.push(currentPage)
          currentPage = []
          currentHeight = 0
        }
        currentPage.push(parsedElements[i])
        currentHeight += h
      }

      if (currentPage.length > 0) result.push(currentPage)
      const newPages = result.length > 0 ? result : [[]]
      
      setPages((oldPages) => {
        if (oldPages.length > 0) {
          const progress = prevProgressRef.current
          let newIdx = Math.round(progress * newPages.length)
          if (newIdx % 2 !== 0) newIdx = Math.max(0, newIdx - 1)
          setPageIndex(Math.min(newIdx, Math.max(0, newPages.length - 2)))
        }
        return newPages
      })
    }

    const observer = new ResizeObserver(() => {
      // Small debounce to avoid ResizeObserver loop limit errors
      requestAnimationFrame(measureAndPaginate)
    })
    
    observer.observe(container)
    
    // Also run once immediately in case ResizeObserver doesn't fire for static sizes
    requestAnimationFrame(measureAndPaginate)

    return () => observer.disconnect()
  }, [parsedElements, fontSize, bookHeight, bookSize, isFullscreen])

  // Track reading progress
  useEffect(() => {
    if (pages.length > 0) {
      prevProgressRef.current = pageIndex / pages.length
    }
  }, [pageIndex, pages.length])

  // Extract headings for TOC
  const tableOfContents = useMemo(() => {
    const toc = []
    pages.forEach((page, idx) => {
      page.forEach(block => {
        if (['h1', 'h2', 'h3'].includes(block.tag)) {
          toc.push({ text: block.text, pageIndex: idx })
        }
      })
    })
    return toc
  }, [pages])

  // Get current page text for TTS
  const currentPageText = useMemo(() => {
    const leftText = (pages[pageIndex] || []).map(b => b.text).join(' ')
    const rightText = (pages[pageIndex + 1] || []).map(b => b.text).join(' ')
    return `${leftText} ${rightText}`.trim()
  }, [pages, pageIndex])

  // Animated page turn
  const animatedTurn = useCallback((direction) => {
    if (isFlipping) return
    setFlipDirection(direction)
    setIsFlipping(true)
    setTimeout(() => {
      if (direction === 'right') {
        setPageIndex((v) => Math.min(Math.max(0, pages.length - 2), v + 2))
      } else {
        setPageIndex((v) => Math.max(0, v - 2))
      }
      setIsFlipping(false)
      setFlipDirection(null)
    }, 800)
  }, [isFlipping, pages.length])

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus()
  }, [showSearch])

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.log(e))
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(e => console.log(e))
      setIsFullscreen(false)
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        animatedTurn('right')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        animatedTurn('left')
      } else if (e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [animatedTurn, toggleFullscreen])

  if (!book && !error) return (
    <main className="rdr-page rdr-page-message">
      <div className="rdr-loading-spinner" />
      <p>Loading book...</p>
    </main>
  )
  if (!readingUrl && !error) return (
    <main className="rdr-page rdr-page-message">
      <p>This book has no online reading resource.</p>
      <button type="button" onClick={() => navigate(-1)}>Go back</button>
    </main>
  )

  return (
    <main className={`rdr-page ${isFullscreen ? 'rdr-page-fullscreen' : ''}`}>
      {activityError && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900" role="status">
          {activityError}
        </p>
      )}
      {/* Top Header Bar */}
      <header className="rdr-header">
        <button type="button" className="rdr-icon-btn" onClick={() => navigate(-1)} title="Back" aria-label="Back to catalog">
          <FiArrowLeft />
        </button>
        <div className="rdr-title-area">
          <FiBookOpen className="rdr-title-icon" aria-hidden="true" />
          <div className="rdr-title-text">
            <strong>{book?.title || 'Unknown Book'}</strong>
            <span>{book?.author || ''}</span>
          </div>
        </div>
        <div className="rdr-header-actions">
          {readingUrl && (
            <a className="rdr-icon-btn" href={readingUrl} target="_blank" rel="noreferrer" title="Open in new tab" aria-label="Open in new tab">
              <FiExternalLink />
            </a>
          )}
          <button type="button" className="rdr-icon-btn" onClick={toggleFullscreen} title="Toggle fullscreen" aria-label="Toggle fullscreen">
            {isFullscreen ? <FiMinimize /> : <FiMaximize />}
          </button>
        </div>
      </header>

      {/* TTS Panel (slide-down) */}
      {showTTS && (
        <div className="rdr-tts-panel">
          <div className="rdr-tts-inner">
            <div className="rdr-tts-settings">
              <label className="rdr-tts-label">
                <span>Language</span>
                <select value={tts.selectedLanguage} onChange={(event) => tts.setSelectedLanguage(event.target.value)} className="rdr-tts-select">
                  <option value="all">All languages</option>
                  {tts.availableLanguages.map((language) => <option key={language} value={language}>{getLanguageLabel(language)}</option>)}
                </select>
              </label>
              <label className="rdr-tts-label">
                <span>Voice</span>
                <select value={tts.selectedVoice} onChange={(event) => tts.setSelectedVoice(event.target.value)} className="rdr-tts-select" disabled={tts.filteredVoices.length === 0}>
                  {tts.filteredVoices.map((voice, index) => (
                    <option key={getVoiceKey(voice)} value={getVoiceKey(voice)}>{voice.name} · {voice.lang}{index === 0 ? ' · recommended' : ''}</option>
                  ))}
                  {tts.filteredVoices.length === 0 && <option value="">No voices available</option>}
                </select>
              </label>
              <label className="rdr-tts-range">
                <span>Speed <output>{tts.rate.toFixed(2)}×</output></span>
                <input type="range" min="0.7" max="1.4" step="0.05" value={tts.rate} onChange={(event) => tts.setRate(Number(event.target.value))} />
              </label>
              <label className="rdr-tts-range">
                <span>Pitch <output>{tts.pitch.toFixed(2)}</output></span>
                <input type="range" min="0.75" max="1.25" step="0.05" value={tts.pitch} onChange={(event) => tts.setPitch(Number(event.target.value))} />
              </label>
              <button type="button" className="rdr-tts-preview" onClick={tts.previewVoice} disabled={!tts.selectedVoice}>Preview voice</button>
            </div>
            <div className="rdr-tts-controls">
              {!tts.isSpeaking ? (
                <button type="button" className="rdr-tts-btn rdr-tts-play" onClick={() => tts.speak(currentPageText)} title="Read aloud">
                  <FiPlay />
                </button>
              ) : tts.isPaused ? (
                <button type="button" className="rdr-tts-btn rdr-tts-play" onClick={tts.resume} title="Resume">
                  <FiPlay />
                </button>
              ) : (
                <button type="button" className="rdr-tts-btn rdr-tts-pause" onClick={tts.pause} title="Pause">
                  <FiPause />
                </button>
              )}
              <button type="button" className="rdr-tts-btn rdr-tts-stop" onClick={tts.stop} title="Stop" disabled={!tts.isSpeaking}>
                <FiSquare />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOC Sidebar */}
      {showTOC && (
        <aside className="rdr-toc-sidebar">
          <div className="rdr-toc-header">
            <h3>Table of Contents</h3>
            <button type="button" className="rdr-icon-btn" onClick={() => setShowTOC(false)} aria-label="Close TOC">&times;</button>
          </div>
          <ul className="rdr-toc-list">
            {tableOfContents.length === 0 ? (
              <li className="rdr-toc-empty">No headings found</li>
            ) : tableOfContents.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`rdr-toc-item ${item.pageIndex === pageIndex ? 'active' : ''}`}
                  onClick={() => { setPageIndex(item.pageIndex); setShowTOC(false) }}
                >
                  <span className="rdr-toc-item-text">{item.text}</span>
                  <span className="rdr-toc-item-page">p.{item.pageIndex + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Main Content Area */}
      <section className="rdr-content" aria-label="Book pages">
        {error ? (
          <div className="rdr-loading-area">
            <p>{error}</p>
          </div>
        ) : !parsedElements ? (
          <div className="rdr-loading-area">
            <div className="rdr-loading-spinner" />
            <p>Preparing the book pages...</p>
          </div>
        ) : viewMode === 'scroll' ? (
          <div className="rdr-scroll-view" style={{ fontSize: `${fontSize}px` }}>
            <PageContent blocks={parsedElements} searchQuery={searchQuery} />
          </div>
        ) : (
          <div className="rdr-book-wrapper">
            {/* Book Spine & Pages */}
            <div className={`rdr-book-container rdr-size-${bookSize}`} style={{ height: `${bookHeight}vh` }}>
              <div className="rdr-book-spine" />
              <div className={`rdr-book-spread ${isFlipping ? `rdr-flip-${flipDirection}` : ''}`}>
                {/* Left Page */}
                <div
                  className="rdr-paper rdr-paper-left"
                  style={{ fontSize: `${fontSize}px` }}
                  ref={measureContainerRef}
                  role="button"
                  tabIndex="0"
                  onClick={() => animatedTurn('left')}
                  onKeyDown={(e) => e.key === 'Enter' && animatedTurn('left')}
                  aria-label="Previous pages"
                >
                  <div className="rdr-page-number">{pageIndex + 1}</div>
                  <div className="rdr-page-text">
                    <PageContent blocks={pages[pageIndex]} searchQuery={searchQuery} />
                  </div>
                </div>
                {/* Right Page */}
                <div
                  className="rdr-paper rdr-paper-right"
                  style={{ fontSize: `${fontSize}px` }}
                  role="button"
                  tabIndex="0"
                  onClick={() => animatedTurn('right')}
                  onKeyDown={(e) => e.key === 'Enter' && animatedTurn('right')}
                  aria-label="Next pages"
                >
                  <div className="rdr-page-number">{pageIndex + 2}</div>
                  <div className="rdr-page-text">
                    <PageContent blocks={pages[pageIndex + 1]} searchQuery={searchQuery} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Search Bar (floating) */}
      {showSearch && (
        <div className="rdr-search-bar">
          <FiSearch />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in book..."
            className="rdr-search-input"
          />
          <button type="button" className="rdr-search-close" onClick={() => { setShowSearch(false); setSearchQuery('') }}>&times;</button>
        </div>
      )}

      {/* Bottom Toolbar */}
      <footer className="rdr-toolbar">
        {/* Find Button */}
        <button type="button" className="rdr-tool-btn rdr-find-btn" onClick={() => setShowSearch(v => !v)}>
          <FiSearch />
          <span>FIND</span>
        </button>

        {/* Navigation Controls */}
        <div className="rdr-nav-group">
          <button type="button" className="rdr-nav-btn" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} title="First page">
            <FiChevronsLeft />
          </button>
          <button type="button" className="rdr-nav-btn" onClick={() => animatedTurn('left')} disabled={pageIndex === 0} title="Previous page">
            <FiChevronLeft />
          </button>
          <span className="rdr-page-indicator">
            {pages.length > 0
              ? `${pageIndex + 1}–${Math.min(pageIndex + 2, pages.length)} / ${pages.length}`
              : parsedElements ? 'Preparing pages...' : 'Loading pages...'}
          </span>
          <button type="button" className="rdr-nav-btn" onClick={() => animatedTurn('right')} disabled={pageIndex + 2 >= pages.length} title="Next page">
            <FiChevronRight />
          </button>
          <button type="button" className="rdr-nav-btn" onClick={() => setPageIndex(Math.max(0, pages.length - 2))} disabled={pageIndex + 2 >= pages.length} title="Last page">
            <FiChevronsRight />
          </button>
        </div>

        {/* Tools */}
        <div className="rdr-tools-group">
          <button type="button" className="rdr-tool-btn" onClick={() => setShowTOC(v => !v)} title="Table of Contents">
            <FiList />
          </button>
          <button type="button" className="rdr-tool-btn" onClick={() => setViewMode(v => v === 'book' ? 'scroll' : 'book')} title={viewMode === 'book' ? 'Switch to scroll view' : 'Switch to book view'}>
            <FiBookOpen />
          </button>
          
          <div className="rdr-slider-control" title="Zoom in / out">
            <FiZoomOut className="rdr-slider-icon" />
            <input 
              type="range" 
              min="10" max="28" 
              value={fontSize} 
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="rdr-slider"
            />
            <FiZoomIn className="rdr-slider-icon" />
          </div>

          <div className="rdr-slider-control" title="Book Height">
            <FiMonitor className="rdr-slider-icon" />
            <input 
              type="range" 
              min="50" max="98" 
              value={bookHeight} 
              onChange={(e) => setBookHeight(Number(e.target.value))}
              className="rdr-slider"
            />
          </div>

          <button type="button" className={`rdr-tool-btn ${showTTS ? 'rdr-tool-active' : ''}`} onClick={() => setShowTTS(v => !v)} title="Text to Speech">
            {tts.isSpeaking ? <FiVolume2 /> : <FiVolumeX />}
          </button>
          <button
            type="button"
            className={`rdr-tool-btn ${isBookmarked ? 'rdr-tool-active' : ''}`}
            onClick={handleBookmark}
            disabled={!book || isBookmarking}
            title={isBookmarked ? 'Remove from your lists' : 'Save to a list'}
            aria-label={isBookmarked ? 'Remove from your lists' : 'Save to a list'}
            aria-pressed={isBookmarked}
          >
            <FiBookmark />
          </button>
          <span className="sr-only" aria-live="polite">{bookmarkMessage}</span>
        </div>
      </footer>
      {showListPicker && book && <ReadingListPicker
        book={book}
        onClose={() => setShowListPicker(false)}
        onSaved={(bookmark, listName) => {
          setIsBookmarked(true)
          setBookmarkMessage(`Saved to ${listName || 'your list'}.`)
          setShowListPicker(false)
        }}
      />}
    </main>
  )
}

function PageContent({ blocks = [], searchQuery = '' }) {
  if (!blocks || blocks.length === 0) return null
  return (
    <>
      {blocks.map((block, index) => {
        if (block.tag === 'img') {
          return <img key={`${block.tag}-${index}`} src={block.src} alt={block.alt} className="rdr-book-img" />
        }
        
        const Tag = ['h1', 'h2', 'h3', 'h4'].includes(block.tag) ? block.tag : 'p'
        if (searchQuery && block.text.toLowerCase().includes(searchQuery.toLowerCase())) {
          const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
          const parts = block.text.split(regex)
          return (
            <Tag key={`${block.tag}-${index}`}>
              {parts.map((part, i) =>
                regex.test(part)
                  ? <mark key={i} className="rdr-highlight">{part}</mark>
                  : part
              )}
            </Tag>
          )
        }
        return <Tag key={`${block.tag}-${index}`}>{block.text}</Tag>
      })}
    </>
  )
}
