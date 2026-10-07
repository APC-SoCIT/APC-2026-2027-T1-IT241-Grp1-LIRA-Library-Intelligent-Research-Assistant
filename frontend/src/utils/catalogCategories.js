const controlledCategories = new Map([
  'Psychology',
  'Engineering',
  'Computer Science',
  'Literature',
  'Photography',
  'Accounting',
  'Architecture',
  'Business & Economics',
  'History',
].map((category) => [category.toLowerCase(), category]))

function categoriesFromSubjects(subjects = []) {
  return [...new Set(subjects
    .filter((subject) => typeof subject === 'string')
    .map((subject) => controlledCategories.get(subject.trim().toLowerCase()))
    .filter(Boolean))]
}

export function adaptCatalogBook(book) {
  return {
    ...book,
    categories: Array.isArray(book.categories) ? book.categories : categoriesFromSubjects(book.subjects),
    title: book.title || 'Untitled record',
    author: book.author || null,
    publisher: [book.publicationPlace, book.publisher].filter(Boolean).join(' ') || null,
    year: book.publicationYear || null,
    online: book.url || null,
  }
}
