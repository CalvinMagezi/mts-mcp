export interface PerplexitySearchArgs {
  query: string;
  focus?: "internet" | "academic" | "writing" | "math" | "coding";
  return_citations?: boolean;
  search_domain_filter?: string[];
  search_recency_filter?: "day" | "week" | "month" | "year";
}

export interface PerplexitySearchResult {
  id: string;
  text: string;
  citations: PerplexityCitation[];
  timestamp: string;
}

export interface PerplexityCitation {
  url: string;
  text: string;
}
