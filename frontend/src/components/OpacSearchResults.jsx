import { useEffect, useMemo, useState } from 'react'
import { FiBookOpen, FiExternalLink, FiList, FiShoppingCart, FiX } from 'react-icons/fi'
import BookCover from './BookCover'
import { translate } from '../i18n/catalogTranslations'

const pageSize = 8

const facets = [
  { key: 'itemType', labelKey: 'itemTypes' },
  { key: 'genres', labelKey: 'genres' },
  { key: 'subjects', labelKey: 'topicsSubjects' },
  { key: 'author', labelKey: 'authors' },
  { key: 'series', labelKey: 'series' },
  { key: 'publicationPlace', labelKey: 'places' },
  { key: 'publisher', labelKey: 'publishers' },
  { key: 'publicationYear', labelKey: 'publicationYears' },
  { key: 'language', labelKey: 'languages' },
  { key: 'isbnAvailability', labelKey: 'isbn' },
  { key: 'resourceAvailability', labelKey: 'onlineResources' },
]

function hasGutenbergResource(book) {
  return book.url?.toLowerCase().includes('gutenberg.org') ?? false
}

function getFacetValues(book, key) {
  if (key === 'isbnAvailability') return [book.isbn ? 'Has ISBN' : 'No ISBN listed']
  if (key === 'resourceAvailability') return [book.url ? 'Has online resource' : 'No online resource listed']
  const value = book[key]
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string' && entry.trim())
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).split('|').map((entry) => entry.trim()).filter(Boolean)
  }
  return []
}

function getFacetLabel(key, value, t) {
  if (key === 'itemType') {
    const normalized = value.toUpperCase()
    const itemTypeKey = `itemType${normalized === 'MAP' || normalized === 'MP' ? 'VM' : normalized}`
    const translated = t(itemTypeKey)
    return translated === itemTypeKey ? value : translated
  }
  if (key === 'isbnAvailability') return t(value === 'Has ISBN' ? 'hasISBN' : 'noISBN')
  if (key === 'resourceAvailability') return t(value === 'Has online resource' ? 'hasOnlineResource' : 'noOnlineResource')
  return value
}

function getOnlineResources(book) {
  return (book.url || '')
    .split('|')
    .map((value) => value.trim())
    .filter((value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
      } catch {
        return false
      }
    })
}

function matchesFacets(book, selectedFacets, exceptKey) {
  return facets.every(({ key }) => {
    if (key === exceptKey || !selectedFacets[key]?.length) return true
    const values = getFacetValues(book, key)
    return selectedFacets[key].some((selected) => values.includes(selected))
  })
}

function FacetSection({ facetKey, label, options, selected, onToggle, emptyMessage, t }) {
  return (
    <details open className="border-b border-[#eee5d7] py-3 last:border-b-0">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#463b2e] marker:hidden">
        <span className="flex items-center justify-between">
          {label}
          <span className="rounded-full bg-[#f4ead9] px-2 py-0.5 text-[0.68rem] font-medium text-[#806747]">{options.length}</span>
        </span>
      </summary>
      {options.length ? (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          {options.map(({ value, count }) => (
            <li key={value}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-xs text-[#675b4a] hover:bg-[#faf5eb]">
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() => onToggle(value)}
                  className="mt-0.5 accent-[#73532f]"
                />
                <span className="min-w-0 flex-1 break-words">{getFacetLabel(facetKey, value, t)}</span>
                <span className="text-[#a3947e]">{count}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[#978873]">{emptyMessage}</p>
      )}
    </details>
  )
}

export default function OpacSearchResults({
  books,
  query,
  sourceFilter,
  language,
  onSourceFilterChange,
  onSelectBook,
  onSaveBookmark,
  onReserveBook,
  isBookmarked,
}) {
  const t = (key) => translate(language, key)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedFacets, setSelectedFacets] = useState({})
  const gutenbergCount = books.filter(hasGutenbergResource).length
  const sourceBooks = books.filter((book) => sourceFilter !== 'gutenberg' || hasGutenbergResource(book))

  const filteredBooks = useMemo(
    () => sourceBooks.filter((book) => matchesFacets(book, selectedFacets)),
    [sourceBooks, selectedFacets],
  )

  const facetOptions = useMemo(() => Object.fromEntries(facets.map(({ key }) => {
    const counts = new Map()
    sourceBooks.filter((book) => matchesFacets(book, selectedFacets, key)).forEach((book) => {
      getFacetValues(book, key).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
    })
    return [key, [...counts].sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
      .map(([value, count]) => ({ value, count }))]
  })), [sourceBooks, selectedFacets])

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize))
  const visiblePage = Math.min(currentPage, totalPages)
  const pageBooks = filteredBooks.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)
  const selectedFacetCount = Object.values(selectedFacets).reduce((count, values) => count + values.length, 0)

  useEffect(() => {
    setCurrentPage(1)
  }, [query, sourceFilter, selectedFacets])

  const toggleFacet = (key, value) => {
    setSelectedFacets((current) => {
      const values = current[key] || []
      const nextValues = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
      return { ...current, [key]: nextValues }
    })
  }

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => Math.max(1, Math.min(visiblePage - 2, totalPages - 4)) + index,
  )

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-[#e8dcc8] bg-[#fffdf8] p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eee5d7] pb-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#9a784a]">{t('refineSearch')}</p>
            <h2 className="mt-1 font-semibold text-[#342c24]">{t('refineSearch')}</h2>
          </div>
          {selectedFacetCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedFacets({})}
              className="text-xs font-semibold text-[#79572f] hover:underline"
            >
              {t('clear')}
            </button>
          )}
        </div>

        <label className="mt-4 block text-xs font-semibold text-[#675b4a]">
          {t('onlineResource')}
          <select
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#ddd1bf] bg-white px-3 py-2 text-sm font-normal text-[#463b2e]"
          >
            <option value="all">{t('allRecords')} ({books.length})</option>
            <option value="gutenberg">{t('gutenbergOnly')} ({gutenbergCount})</option>
          </select>
        </label>

        <div className="mt-3">
          {facets.map(({ key, labelKey }) => (
            <FacetSection
              key={key}
              facetKey={key}
              label={t(labelKey)}
              emptyMessage={t('kohaHasNotSupplied')}
              options={facetOptions[key]}
              selected={selectedFacets[key] || []}
              onToggle={(value) => toggleFacet(key, value)}
              t={t}
            />
          ))}
        </div>

        <p className="mt-3 border-t border-[#eee5d7] pt-3 text-[0.68rem] leading-5 text-[#978873]">
          {t('availabilityNotProvided')}
        </p>
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#342c24]">
              {query.trim() ? t('searchResults') : t('libraryCatalog')}
            </h2>
            <p className="mt-1 text-sm text-[#81725f]">
              {t('showing')} {filteredBooks.length} {filteredBooks.length === 1 ? t('record') : t('records')}
              {sourceFilter === 'gutenberg' ? ` ${t('withGutenberg')}` : ` ${t('fromKohaSuffix')}`}
            </p>
          </div>
          {selectedFacetCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedFacets).flatMap(([key, values]) => values.map((value) => (
                <button
                  key={`${key}:${value}`}
                  type="button"
                  onClick={() => toggleFacet(key, value)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#f4ead9] px-3 py-1 text-xs font-medium text-[#674a29]"
                >
                  {getFacetLabel(key, value, t)}<FiX aria-hidden="true" />
                </button>
              )))}
            </div>
          )}
        </div>

        {filteredBooks.length === 0 ? (
          <div className="rounded-2xl border border-[#e8dcc8] bg-[#fffdf8] px-6 py-12 text-center">
            <FiBookOpen className="mx-auto mb-3 h-8 w-8 text-[#a38b66]" aria-hidden="true" />
            <h3 className="font-semibold text-[#342c24]">{t('noMatchingRecords')}</h3>
            <p className="mt-1 text-sm text-[#81725f]">
              {t('tryRemovingFilter')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pageBooks.map((book) => {
              const resources = getOnlineResources(book)
              return (
                <article key={book.id} className="flex gap-4 rounded-2xl border border-[#e8dcc8] bg-[#fffdf8] p-4 shadow-sm transition-shadow hover:shadow-md sm:gap-5 sm:p-5">
                  <button
                    type="button"
                    onClick={() => onSelectBook(book)}
                    className="h-28 w-[4.5rem] shrink-0 overflow-hidden rounded-md shadow-md transition-transform hover:-translate-y-0.5 sm:h-36 sm:w-24"
                    aria-label={`${t('viewBook')} ${book.title}`}
                  >
                    <BookCover book={book} className="h-full w-full" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectBook(book)}
                      className="text-left text-lg font-semibold leading-snug text-[#49351f] hover:text-[#79572f] hover:underline"
                    >
                      {book.title}
                    </button>
                    <p className="mt-1 text-sm text-[#675b4a]">{book.author || t('authorNotListed')}</p>

                    <dl className="mt-3 grid gap-x-5 gap-y-1 text-xs text-[#81725f] sm:grid-cols-2">
                      {book.publisher && <div><dt className="inline font-semibold">{t('publisher')}: </dt><dd className="inline">{book.publisher}</dd></div>}
                      {book.publicationYear && <div><dt className="inline font-semibold">{t('year')}: </dt><dd className="inline">{book.publicationYear}</dd></div>}
                      {book.isbn && <div><dt className="inline font-semibold">{t('isbn')}: </dt><dd className="inline">{book.isbn}</dd></div>}
                      {book.itemType && <div><dt className="inline font-semibold">{t('type')}: </dt><dd className="inline">{getFacetLabel('itemType', book.itemType, t)}</dd></div>}
                      {book.genres?.length > 0 && <div className="sm:col-span-2"><dt className="inline font-semibold">{t('genre')}: </dt><dd className="inline">{book.genres.join(', ')}</dd></div>}
                    </dl>

                    {resources.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                        {resources.map((resource) => (
                          <li key={resource}>
                            <a href={resource} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#79572f] hover:underline">
                              <FiExternalLink aria-hidden="true" /> {t('onlineResource')}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#79572f]">
                      <button type="button" onClick={() => onSaveBookmark(book)} className="inline-flex items-center gap-1 hover:underline">
                        <FiList aria-hidden="true" /> {isBookmarked(book) ? t('removeFromLists') : t('addToLists')}
                      </button>
                      <button type="button" onClick={() => onReserveBook(book)} className="inline-flex items-center gap-1 hover:underline">
                        <FiShoppingCart aria-hidden="true" /> {t('addToReservationCart')}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-5 flex flex-wrap items-center justify-center gap-2" aria-label={t('catalogResultPages')}>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={visiblePage === 1}
              className="rounded-lg border border-[#ddd1bf] bg-[#fffdf8] px-3 py-2 text-sm text-[#674a29] disabled:opacity-40"
            >
              {t('previous')}
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                aria-current={page === visiblePage ? 'page' : undefined}
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg border px-3 py-2 text-sm ${page === visiblePage ? 'border-[#73532f] bg-[#73532f] text-white' : 'border-[#ddd1bf] bg-[#fffdf8] text-[#674a29]'}`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={visiblePage === totalPages}
              className="rounded-lg border border-[#ddd1bf] bg-[#fffdf8] px-3 py-2 text-sm text-[#674a29] disabled:opacity-40"
            >
              {t('next')}
            </button>
          </nav>
        )}
      </div>
    </section>
  )
}
