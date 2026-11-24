import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectCitationStyle, findBookForCitation, formatBookCitation } from './bookCitation.js'

const currentBook = {
  id: 1,
  title: 'The Design of Everyday Things',
  author: 'Norman, Donald A.',
  publisher: 'New York Basic Books',
  publicationPlace: 'New York',
  publicationYear: 2013,
  edition: 'Revised and expanded edition',
}

describe('book citation helpers', () => {
  it('recognizes the supported citation styles', () => {
    assert.equal(detectCitationStyle('Please format this in APA 7th edition'), 'apa7')
    assert.equal(detectCitationStyle('MLA 9'), 'mla9')
    assert.equal(detectCitationStyle('Chicago 17th'), 'chicago17')
    assert.equal(detectCitationStyle('IEEE'), 'ieee')
    assert.equal(detectCitationStyle('Harvard style'), 'harvard')
  })

  it('selects a named catalog book instead of the currently viewed book', () => {
    const requestedBook = { id: 2, title: 'Clean Code' }
    assert.equal(
      findBookForCitation('Create a citation for Clean Code in APA 7', currentBook, [currentBook, requestedBook]),
      requestedBook,
    )
    assert.equal(findBookForCitation('Cite this book in MLA', currentBook, [currentBook]), currentBook)
  })

  it('formats available catalog metadata and reports missing details without inventing them', () => {
    const citation = formatBookCitation(currentBook, 'apa7')
    assert.equal(citation.text, 'Norman, D. A. (2013). The Design of Everyday Things (Revised and expanded edition). Basic Books.')
    assert.deepEqual(citation.missingFields, [])

    assert.match(formatBookCitation(currentBook, 'mla9').text, /Norman, Donald A\..*Revised and expanded edition.*Basic Books, 2013/)
    assert.match(formatBookCitation(currentBook, 'chicago17').text, /New York: Basic Books, 2013/)
    assert.match(formatBookCitation(currentBook, 'ieee').text, /D\. A\. Norman.*New York, Basic Books, 2013/)
    assert.match(formatBookCitation(currentBook, 'harvard').text, /\(2013\).*New York: Basic Books/)

    const partial = formatBookCitation({ id: 3, title: 'Unknown Book' }, 'mla9')
    assert.equal(partial.text, 'Unknown Book.')
    assert.deepEqual(partial.missingFields, ['author', 'publication year', 'publisher'])
  })

  it('includes an available online source URL but never cites an internal reader URL', () => {
    const url = 'https://library.example.edu/ebooks/design'
    const onlineBook = {
      ...currentBook,
      resources: [{
        sourceUrl: url,
        contentUrl: '/api/catalog/books/1/resources/ebook/content',
        format: 'epub',
        label: 'E-book',
      }],
    }

    for (const style of ['apa7', 'mla9', 'chicago17', 'ieee', 'harvard']) {
      const citation = formatBookCitation(onlineBook, style)
      assert.equal(citation.url, url)
      assert.ok(citation.text.includes(url))
    }

    const privateReaderOnly = formatBookCitation({
      ...currentBook,
      resources: [{ contentUrl: '/api/catalog/books/1/resources/ebook/content', format: 'epub' }],
    }, 'apa7')
    assert.equal(privateReaderOnly.url, null)
    assert.ok(!privateReaderOnly.text.includes('/api/catalog'))
  })
})
