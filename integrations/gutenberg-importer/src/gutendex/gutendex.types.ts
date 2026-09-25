export interface GutendexPerson {
  name?: unknown;
  birth_year?: unknown;
  death_year?: unknown;
}

export interface GutendexBook {
  id?: unknown;
  title?: unknown;
  authors?: unknown;
  subjects?: unknown;
  languages?: unknown;
  summaries?: unknown;
  formats?: unknown;
  bookshelves?: unknown;
  copyright?: unknown;
  media_type?: unknown;
  download_count?: unknown;
}

export interface NormalizedAuthor {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
}

export interface NormalizedFormat {
  mediaType: string;
  url: string;
}

export interface NormalizedBook {
  id: number;
  title: string;
  authors: NormalizedAuthor[];
  subjects: string[];
  languages: string[];
  summaries: string[];
  formats: NormalizedFormat[];
  bookshelves: string[];
  copyright: boolean | null;
  mediaType: string | null;
  source: GutendexBook;
}