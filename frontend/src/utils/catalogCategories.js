export function adaptCatalogBook(book) {
  return {
    ...book,
    title: book.title || 'Untitled record',
    author: book.author || null,
    publisher: [book.publicationPlace, book.publisher].filter(Boolean).join(' ') || null,
    year: book.publicationYear || null,
    online: book.url || null,
  }
}
