const normalize = (value) => (value || '').toString().toLowerCase().trim()
const tokenize = (value) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2)

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

export function buildCatalogRecommendations(books, history, selectedBook, limit = 6) {
  const seeds = recentSeeds(history, selectedBook).slice(0, 12)
  const excludedIds = new Set([
    ...(history?.views || []).map((book) => book.book_id),
    ...(history?.readings || []).map((book) => book.book_id),
    ...(selectedBook ? [selectedBook.id] : []),
  ])
  const searches = (history?.searches || []).slice(0, 10).map((entry) => tokenize(entry.query))

  if (seeds.length === 0 && searches.length === 0) return []

  return books
    .filter((book) => !excludedIds.has(book.id))
    .map((book) => {
      let score = 0
      const bookAuthor = normalize(book.author)
      const bookTitleTokens = new Set(tokenize(book.title))
      const bookText = normalize([book.title, book.author, book.publisher].filter(Boolean).join(' '))

      seeds.forEach((seed, index) => {
        const recencyWeight = Math.max(2, 14 - index * 2)
        const seedAuthor = normalize(seed.author)
        if (seedAuthor && bookAuthor && seedAuthor === bookAuthor) score += 12 * recencyWeight
        if (seed.item_type && book.itemType && normalize(seed.item_type) === normalize(book.itemType)) score += 1.5 * recencyWeight
        score += sharedValues(seed.genres, book.genres) * 10 * recencyWeight
        score += sharedValues(seed.subjects, book.subjects) * 7 * recencyWeight
        score += sharedValues(seed.series ? [seed.series] : [], book.series ? [book.series] : []) * 6 * recencyWeight

        const sharedTitleWords = tokenize(seed.title).filter((word) => bookTitleTokens.has(word)).length
        score += sharedTitleWords * recencyWeight
      })

      searches.forEach((tokens, index) => {
        const weight = Math.max(1, 5 - index * 0.35)
        score += tokens.filter((token) => bookText.includes(token)).length * weight
      })

      return { book, score }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.book.title.localeCompare(right.book.title))
    .slice(0, limit)
    .map(({ book }) => book)
}
