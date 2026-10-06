import { useEffect, useState } from 'react'
import { FiBookOpen } from 'react-icons/fi'

function getCoverSources(book) {
  const sources = []
  const isbn = book.isbn?.match(/\b(?:97[89])?\d{9}[\dX]\b/i)?.[0]
  if (isbn) {
    sources.push(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`)
  }

  const gutenbergId = book.url?.match(/gutenberg\.org\/ebooks\/(\d+)/i)?.[1]
  if (gutenbergId) {
    sources.push(`https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.medium.jpg`)
  }
  return sources
}

export default function BookCover({ book, className = '' }) {
  const sources = getCoverSources(book)
  const [sourceIndex, setSourceIndex] = useState(0)

  useEffect(() => {
    setSourceIndex(0)
  }, [book.id, book.isbn, book.url])

  if (sources.length === 0 || sourceIndex >= sources.length) {
    return (
      <div className={`relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f7edda] to-[#e9d5b5] px-2 text-center text-[#806747] ${className}`}>
        <div className="absolute inset-y-0 left-0 w-2 bg-[#806747]/15" aria-hidden="true" />
        <FiBookOpen className="mb-2 h-7 w-7 shrink-0" aria-hidden="true" />
        <span className="line-clamp-3 text-[0.6rem] font-semibold leading-tight">{book.title}</span>
        <span className="mt-1 line-clamp-2 text-[0.52rem]">{book.author || 'Author not listed'}</span>
        <span className="sr-only">No external cover image is available; this is a generated text fallback.</span>
      </div>
    )
  }

  return (
    <img
      src={sources[sourceIndex]}
      alt={`Cover of ${book.title}`}
      loading="eager"
      onError={() => setSourceIndex((index) => index + 1)}
      className={`bg-gradient-to-br from-[#f7edda] to-[#e9d5b5] object-cover ${className}`}
    />
  )
}
