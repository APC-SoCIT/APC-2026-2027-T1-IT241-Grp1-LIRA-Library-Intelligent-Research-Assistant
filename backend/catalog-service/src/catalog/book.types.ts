export interface Book {
  id: number;
  title: string | null;
  subtitle: string | null;
  author: string | null;
  isbn: string | null;
  issn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  publicationPlace: string | null;
  edition: string | null;
  language: string | null;
  description: string | null;
  itemType: string | null;
  url: string | null;
}

export interface BookListResponse {
  items: Book[];
  pagination: { page: number; limit: number };
}
