import * as AdmZip from 'adm-zip';
import { BookSummaryExtractor } from '../src/catalog/book-summary-extractor';

describe('BookSummaryExtractor', () => {
  const extractor = new BookSummaryExtractor();

  it('normalizes text resources before returning them', async () => {
    await expect(extractor.extract(Buffer.from('  One\r\n\r\n\r\n two  '), 'text', 'en'))
      .resolves.toBe('One\n\ntwo');
  });

  it('extracts EPUB chapters in spine order', async () => {
    const epub = new AdmZip();
    epub.addFile('META-INF/container.xml', Buffer.from(
      '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    ));
    epub.addFile('OEBPS/content.opf', Buffer.from(
      '<package><manifest><item id="chapter" href="chapter.xhtml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
    ));
    epub.addFile('OEBPS/chapter.xhtml', Buffer.from(
      '<html><body><h1>Chapter One</h1><p>Readable chapter text.</p></body></html>',
    ));

    await expect(extractor.extract(epub.toBuffer(), 'epub', 'en'))
      .resolves.toBe('Chapter One\nReadable chapter text.');
  });
});
