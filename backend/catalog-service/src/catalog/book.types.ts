import { BookResource } from './resource.types';

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
  genres: string[];
  subjects: string[];
  categories?: string[];
  series: string | null;
  url: string | null;
  coverUrl?: string | null;
  /** Original Koha URL retained for MARC writes; coverUrl is the browser proxy. */
  coverSourceUrl?: string | null;
  resources: BookResource[];
}

export interface BookListResponse {
  items: Book[];
  pagination: { page: number; limit: number };
}
