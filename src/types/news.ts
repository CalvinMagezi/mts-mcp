export interface NewsArticle {
  id: string;
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  content: string | null;
}

export interface SearchNewsArgs {
  q: string;
  language?: string;
  sortBy?: "relevancy" | "popularity" | "publishedAt";
  pageSize?: number;
}

export interface GetHeadlinesArgs {
  country?: string;
  category?:
    | "business"
    | "entertainment"
    | "general"
    | "health"
    | "science"
    | "sports"
    | "technology";
  sources?: string;
  pageSize?: number;
}
