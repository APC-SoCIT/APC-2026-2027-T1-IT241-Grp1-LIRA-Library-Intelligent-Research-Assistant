const normalize = (value) => (value || '').toString().toLowerCase().trim()
const ignoredTokens = new Set(['about', 'and', 'are', 'for', 'from', 'into', 'school', 'the', 'this', 'with', 'book', 'books'])
const tokenize = (value) => normalize(value)
  .split(/[^\p{L}\p{N}]+/u)
  .filter((word) => word.length > 2 && !ignoredTokens.has(word))

function recentSeeds(history, selectedBook) {
  const seeds = [
    ...(history?.views || []).map((book) => ({ ...book, activityAt: book.viewed_at })),
    ...(history?.readings || []).map((book) => ({ ...book, activityAt: book.last_read_at })),
  ].sort((left, right) => new Date(right.activityAt).getTime() - new Date(left.activityAt).getTime())

  if (selectedBook && !seeds.some((seed) => seed.book_id === selectedBook.id)) {
    seeds.unshift({
      ...selectedBook,
      book_id: selectedBook.id,
      activityAt: new Date().toISOString(),
    })
  }
  return seeds
}

function sharedValues(left = [], right = []) {
  const rightValues = new Set(right.map(normalize))
  return left.filter((value) => rightValues.has(normalize(value))).length
}

export function buildCatalogRecommendations(books, history, selectedBook, { query = '', school = '', limit = 6 } = {}) {
  const seeds = recentSeeds(history, selectedBook).slice(0, 12)
  const excludedIds = new Set([
    ...(history?.views || []).map((book) => book.book_id),
    ...(history?.readings || []).map((book) => book.book_id),
    ...(selectedBook ? [selectedBook.id] : []),
  ])
  const searches = (history?.searches || []).slice(0, 10).map((entry) => tokenize(entry.query))
  const queryTokens = tokenize(query)
  const schoolTokens = tokenize(school)

  if (seeds.length === 0 && searches.length === 0 && queryTokens.length === 0 && schoolTokens.length === 0) return []

  return books
    .filter((book) => !excludedIds.has(book.id))
    .map((book) => {
      let score = 0
      const bookAuthor = normalize(book.author)
      const titleTokens = new Set(tokenize([book.title, book.subtitle].filter(Boolean).join(' ')))
      const subjectTokens = new Set(tokenize([...(book.genres || []), ...(book.subjects || []), book.itemType].filter(Boolean).join(' ')))
      const bookTokens = new Set(tokenize([
        book.title,
        book.subtitle,
        book.author,
        book.publisher,
        book.description,
        book.series,
        book.itemType,
        ...(book.genres || []),
        ...(book.subjects || []),
      ].filter(Boolean).join(' ')))

      queryTokens.forEach((token) => {
        if (bookTokens.has(token)) score += 4
        if (titleTokens.has(token)) score += 8
        if (subjectTokens.has(token)) score += 6
      })

      schoolTokens.forEach((token) => {
        if (bookTokens.has(token)) score += 2
        if (titleTokens.has(token)) score += 4
        if (subjectTokens.has(token)) score += 7
      })

      seeds.forEach((seed, index) => {
        const recencyWeight = Math.max(2, 14 - index * 2)
        const seedAuthor = normalize(seed.author)
        if (seedAuthor && bookAuthor && seedAuthor === bookAuthor) score += 12 * recencyWeight
        if (seed.item_type && book.itemType && normalize(seed.item_type) === normalize(book.itemType)) score += 1.5 * recencyWeight
        score += sharedValues(seed.genres, book.genres) * 10 * recencyWeight
        score += sharedValues(seed.subjects, book.subjects) * 7 * recencyWeight
        score += sharedValues(seed.series ? [seed.series] : [], book.series ? [book.series] : []) * 6 * recencyWeight

        const sharedTitleWords = tokenize(seed.title).filter((word) => titleTokens.has(word)).length
        score += sharedTitleWords * recencyWeight
      })

      searches.forEach((tokens, index) => {
        const weight = Math.max(1, 5 - index * 0.35)
        score += tokens.filter((token) => bookTokens.has(token)).length * weight
      })

      return { book, score }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || (left.book.title || '').localeCompare(right.book.title || ''))
    .slice(0, limit)
    .map(({ book }) => book)
}
