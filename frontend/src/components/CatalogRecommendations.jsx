import { FiBookOpen } from 'react-icons/fi'
import BookCover from './BookCover'
import { translate } from '../i18n/catalogTranslations'
import { buildCatalogRecommendations } from '../services/catalogRecommendations'

export default function CatalogRecommendations({ books, history, selectedBook, language, onSelectBook }) {
  const recommendations = buildCatalogRecommendations(books, history, selectedBook)

  return (
    <section className="mt-10 rounded-3xl border border-[#e8dcc8] bg-gradient-to-br from-[#faf5eb] to-[#fffdf8] p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#73532f] text-white">
          <FiBookOpen aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[#342c24]">{translate(language, 'recommendationsTitle')}</h2>
          <p className="mt-1 text-sm text-[#81725f]">{translate(language, 'recommendationsIntro')}</p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-[#d9c7a9] bg-white/70 px-5 py-6 text-sm leading-6 text-[#81725f]">
          {translate(language, 'recommendationsEmpty')}
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onSelectBook(book)}
              className="flex min-w-0 items-center gap-4 rounded-2xl border border-[#e8dcc8] bg-white p-3 text-left transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="h-24 w-16 shrink-0 overflow-hidden rounded-md shadow-sm">
                <BookCover book={book} className="h-full w-full" />
              </span>
              <span className="min-w-0">
                <span className="block line-clamp-2 font-semibold leading-5 text-[#49351f]">{book.title}</span>
                <span className="mt-1 block truncate text-sm text-[#81725f]">{book.author || translate(language, 'authorNotListed')}</span>
                {book.itemType && <span className="mt-2 inline-block rounded-full bg-[#f4ead9] px-2 py-1 text-[0.65rem] text-[#806747]">{book.itemType}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
