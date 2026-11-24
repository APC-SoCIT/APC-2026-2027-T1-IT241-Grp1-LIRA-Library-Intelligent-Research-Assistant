export const citationStyles = [
  { id: 'apa7', label: 'APA 7th edition' },
  { id: 'mla9', label: 'MLA 9th edition' },
  { id: 'chicago17', label: 'Chicago 17th edition' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'harvard', label: 'Harvard' },
]

const normalize = (value) => String(value || '')
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

export function isCitationRequest(value) {
  return /\b(citation|cite|bibliography|references?|pagsipi|sanggunian)\b/i.test(value)
    || /[引用引文参考文献인용]/u.test(value)
}

export function detectCitationStyle(value) {
  if (/\bapa(?:\s*[- ]?7(?:th)?(?:\s+edition)?)?\b/i.test(value)) return 'apa7'
  if (/\bmla(?:\s*[- ]?9(?:th)?(?:\s+edition)?)?\b/i.test(value)) return 'mla9'
  if (/\bchicago(?:\s*[- ]?17(?:th)?(?:\s+edition)?)?\b/i.test(value)) return 'chicago17'
  if (/\bieee\b/i.test(value)) return 'ieee'
  if (/\bharvard\b/i.test(value)) return 'harvard'
  return null
}

export function findBookForCitation(question, currentBook, books = []) {
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

  const refersToCurrent = /\b(this|that|current|currently viewing|currently open|here|it)\b/i.test(question)
  if (currentBook && refersToCurrent) return currentBook

  const target = question.match(/\b(?:for|of)\s+(?:the\s+)?(?:book\s+)?(.+)$/i)?.[1]
  const targetTitle = target?.replace(/\b(?:in|using)\s+(?:apa|mla|chicago|ieee|harvard).+$/i, '').trim()
  const genericTarget = !targetTitle || /^(?:(?:a|an|the)\s+)?(?:book|this book|that book|current book|it)$/i.test(targetTitle)
  const styleOnlyTarget = targetTitle && detectCitationStyle(targetTitle)
    && normalize(targetTitle).split(' ').every((token) => ['apa', 'mla', 'chicago', 'ieee', 'harvard', '7', '7th', '9', '9th', '17', '17th', 'edition'].includes(token))
  const namesOtherBook = Boolean(targetTitle && !genericTarget && !styleOnlyTarget)

  if (currentBook && !namesOtherBook) return currentBook
  return null
}

function splitAuthors(value) {
  return String(value || '')
    .split(/\s*;\s*|\s+\band\b\s+|\s*&\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)
}

function parseAuthor(name) {
  const comma = name.indexOf(',')
  if (comma > 0) {
    return { family: name.slice(0, comma).trim(), given: name.slice(comma + 1).trim() }
  }
  const parts = name.trim().split(/\s+/)
  return { family: parts.pop() || name, given: parts.join(' ') }
}

function initials(given) {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.split('-').map((namePart) => `${namePart[0].toLocaleUpperCase()}.`).join('-'))
    .join(' ')
}

function authorText(authors, style) {
  const parsed = authors.map(parseAuthor)
  if (parsed.length === 0) return ''

  if (style === 'apa7') {
    const names = parsed.slice(0, 20).map(({ family, given }) => `${family}, ${initials(given)}`.trim())
    return names.length > 1 ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}` : names[0]
  }

  if (style === 'ieee') {
    const names = parsed.map(({ family, given }) => `${initials(given)} ${family}`.trim())
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  }

  const names = parsed.map(({ family, given }, index) => (
    index === 0 ? `${family}, ${given}`.trim() : `${given} ${family}`.trim()
  ))
  if (names.length === 1) return names[0]
  if (style === 'mla9' && names.length > 2) return `${names[0]}, et al.`
  if (style === 'chicago17' && names.length > 3) return `${names[0]}, et al.`
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function cleanPublisher(book) {
  const publisher = String(book.publisher || '').trim()
  const place = String(book.publicationPlace || '').trim()
  if (place && publisher.toLocaleLowerCase().startsWith(place.toLocaleLowerCase())) {
    return publisher.slice(place.length).replace(/^[\s,:-]+/, '')
  }
  return publisher
}

function onlineSourceUrl(book) {
  const resourceUrls = (book.resources || [])
    .filter((resource) => resource.format !== 'image' && !/cover/i.test(resource.label || ''))
    .map((resource) => resource.sourceUrl)
  const legacyUrls = String(book.url || book.online || '').split('|')

  for (const candidate of [...resourceUrls, ...legacyUrls]) {
    try {
      const url = new URL(candidate)
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href
    } catch {
      continue
    }
  }
  return null
}

export function formatBookCitation(book, styleId) {
  const style = citationStyles.find(({ id }) => id === styleId)
  if (!style) throw new Error(`Unsupported citation style: ${styleId}`)

  const title = [book.title, book.subtitle].filter(Boolean).join(': ')
  const authors = splitAuthors(book.author)
  const author = authorText(authors, styleId)
  const year = book.publicationYear || book.year
  const publisher = cleanPublisher(book)
  const place = String(book.publicationPlace || '').trim()
  const edition = String(book.edition || '').trim()
  const editionLabel = edition && (/\b(?:ed\.?|edition)\b/i.test(edition) ? edition : `${edition} ed.`)
  const url = onlineSourceUrl(book)
  const missingFields = [
    !authors.length && 'author',
    !year && 'publication year',
    !publisher && 'publisher',
  ].filter(Boolean)
  let text

  if (styleId === 'apa7') {
    const citedTitle = `${title}${editionLabel ? ` (${editionLabel})` : ''}`
    const printedCitation = author
      ? `${author} (${year || 'n.d.'}). ${citedTitle}${publisher ? `. ${publisher}` : ''}.`
      : `${citedTitle}${publisher ? `. ${publisher}` : ''}.`
    text = url ? `${printedCitation.replace(/[.\s]+$/, '')} ${url}` : printedCitation
  } else if (styleId === 'mla9') {
    const imprint = [publisher, year].filter(Boolean).join(', ')
    const printedCitation = `${author ? `${author}. ` : ''}${title}.${editionLabel ? ` ${editionLabel}.` : ''}${imprint ? ` ${imprint}.` : ''}`
    text = url ? `${printedCitation} ${url}.` : printedCitation
  } else if (styleId === 'chicago17') {
    const imprint = [place && publisher ? `${place}: ${publisher}` : place || publisher, year].filter(Boolean).join(', ')
    const printedCitation = `${author ? `${author}. ` : ''}${title}.${editionLabel ? ` ${editionLabel}.` : ''}${imprint ? ` ${imprint}.` : ''}`
    text = url ? `${printedCitation} ${url}.` : printedCitation
  } else if (styleId === 'ieee') {
    const imprint = [place, publisher, year].filter(Boolean).join(', ')
    const printedCitation = `${author ? `${author}, ` : ''}${title}${editionLabel ? `, ${editionLabel}` : ''}${imprint ? `, ${imprint}` : ''}.`
    text = url ? `${printedCitation.replace(/[.\s]+$/, '')}, [Online]. Available: ${url}.` : printedCitation
  } else {
    const imprint = [place && publisher ? `${place}: ${publisher}` : place || publisher].filter(Boolean)[0]
    const printedCitation = `${author ? `${author} ` : ''}(${year || 'n.d.'}) ${title}.${editionLabel ? ` ${editionLabel}.` : ''}${imprint ? ` ${imprint}.` : ''}`
    text = url ? `${printedCitation} Available at: ${url}.` : printedCitation
  }

  return { style: style.label, text, title, url, missingFields }
}
