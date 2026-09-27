const categoryRules = [
  { name: 'Psychology', terms: ['psychology', 'stress', 'emotion', 'behavior', 'mind'] },
  { name: 'Engineering', terms: ['engineering', 'mechanics', 'electric circuit', 'electronics'] },
  { name: 'Computer Science', terms: ['computer', 'programming', 'software', 'algorithm', 'code', 'technology'] },
  { name: 'Literature', terms: ['literature', 'novel', 'poetry', 'gatsby', 'prejudice', 'fiction'] },
  { name: 'Photography', terms: ['photograph', 'exposure', 'camera', 'visual media'] },
  { name: 'Accounting', terms: ['accounting', 'finance', 'financial', 'valuation', 'economics'] },
  { name: 'Architecture', terms: ['architecture', 'architectural', 'building', 'planning', 'design'] },
  { name: 'History', terms: ['history', 'historical', 'philippine islands', 'civilization'] },
  { name: 'Business & Economics', terms: ['business', 'management', 'marketing', 'economy', 'self-marketing'] },
]

export function categorizeBook(book) {
  const searchableText = [book.category, book.subjects, book.title, book.author, book.itemType]
    .flat().filter(Boolean).join(' ').toLowerCase()
  return categoryRules.find(({ terms }) => terms.some((term) => searchableText.includes(term)))?.name || 'Other'
}

export function adaptCatalogBook(book) {
  const category = categorizeBook(book)
  return {
    ...book,
    title: book.title || 'Untitled record',
    author: book.author || 'Unknown author',
    publisher: [book.publicationPlace, book.publisher].filter(Boolean).join(': ') || 'Publisher not listed',
    year: book.publicationYear || 'n.d.',
    category,
    online: book.url || 'No digital copy available',
    itemType: book.itemType || 'BOOKS',
    location: 'Asia Pacific College Library',
    availability: 'Availability details are managed by the library.',
    cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&q=80',
  }
}
