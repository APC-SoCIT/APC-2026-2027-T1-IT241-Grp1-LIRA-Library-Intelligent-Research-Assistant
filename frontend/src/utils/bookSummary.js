const normalize = (value) => String(value || '')
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

export function isBookSummaryRequest(value) {
  return /\b(summarize|summarise|summary|summarization|summarisation|synopsis|overview|recap|buod)\b/i.test(value)
    || /[总结摘要要約요약]/u.test(value)
    || /\b(?:what is|tell me) (?:this|the|that) book about\b/i.test(value)
}

export function findBookForSummary(question, currentBook, books = []) {
  const query = normalize(question)
  const candidates = [...new Map(
    [...books, ...(currentBook ? [currentBook] : [])]
      .filter((book) => book?.title)
      .map((book) => [String(book.id), book]),
  ).values()].sort((left, right) => normalize(right.title).length - normalize(left.title).length)

  const exactMatch = candidates.find((book) => {
    const title = normalize([book.title, book.subtitle].filter(Boolean).join(' '))
    return title.length > 3 && query.includes(title)
  })
  if (exactMatch) return exactMatch
  const requestedTitle = question.match(/\b(?:summarize|summarise|summary|synopsis|overview|recap)\b(?:\s+(?:of|for))?\s+(.+?)(?:[?.!,]|$)/i)?.[1]
    ?.replace(/^(?:the\s+)?book\s+/i, '')
    .replace(/\s+(?:for me|please|thanks?|thank you)$/i, '')
    .trim()
  const refersToCurrent = !requestedTitle || /^(?:(?:(?:this|that|current|my|a|an|the)\s+)?book|(?:this|that|it)|my current book|the one i(?:'m| am) reading|i(?:'m| am)(?: currently)? (?:reading|viewing)|currently reading|currently viewing)(?:\s+right now)?$/i.test(requestedTitle)
  if (currentBook && refersToCurrent) return currentBook
  return null
}

export function findReadableBookResource(book, resourceId) {
  const resources = (book?.resources || []).filter((resource) =>
    resource.id && resource.contentUrl && ['pdf', 'epub', 'html', 'text'].includes(resource.format))
  return resources.find((resource) => resource.id === resourceId) || resources[0] || null
}
