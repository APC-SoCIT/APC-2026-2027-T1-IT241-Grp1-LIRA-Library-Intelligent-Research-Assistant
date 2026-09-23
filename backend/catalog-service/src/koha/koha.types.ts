export interface KohaBiblio {
  biblio_id?: number;
  id?: number;
  title?: string | null;
  subtitle?: string | null;
  author?: string | null;
  isbn?: string | null;
  issn?: string | null;
  publisher?: string | null;
  publication_year?: number | string | null;
  publication_place?: string | null;
  edition?: string | null;
  language?: string | null;
  description?: string | null;
  item_type?: string | null;
  url?: string | null;
  [key: string]: unknown;
}

export type KohaBiblioResponse = KohaBiblio | KohaBiblio[] | { biblios?: KohaBiblio[]; items?: KohaBiblio[] };
