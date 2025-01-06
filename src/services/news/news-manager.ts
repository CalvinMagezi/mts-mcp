import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

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

export class NewsManager {
  private apiKey: string;
  private articleCache: Map<string, NewsArticle>;

  constructor(private server: Server) {
    this.apiKey = process.env.NEWS_API_KEY || "";
    this.articleCache = new Map();

    if (!this.apiKey) {
      console.warn("NEWS_API_KEY environment variable is not set");
    }
  }

  async searchNews(args: SearchNewsArgs): Promise<NewsArticle[]> {
    if (!this.apiKey) {
      throw new Error("NEWS_API_KEY environment variable is required");
    }

    try {
      const response = await axios.get("https://newsapi.org/v2/everything", {
        params: {
          ...args,
          apiKey: this.apiKey,
        },
      });

      const articles = response.data.articles.map(
        (article: NewsArticle, index: number) => {
          const id = `search-${Date.now()}-${index}`;
          const articleWithId = { ...article, id };
          this.articleCache.set(id, articleWithId);
          return articleWithId;
        }
      );

      return articles;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`News API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async getHeadlines(args: GetHeadlinesArgs): Promise<NewsArticle[]> {
    if (!this.apiKey) {
      throw new Error("NEWS_API_KEY environment variable is required");
    }

    try {
      const response = await axios.get("https://newsapi.org/v2/top-headlines", {
        params: {
          ...args,
          apiKey: this.apiKey,
        },
      });

      const articles = response.data.articles.map(
        (article: NewsArticle, index: number) => {
          const id = `headline-${Date.now()}-${index}`;
          const articleWithId = { ...article, id };
          this.articleCache.set(id, articleWithId);
          return articleWithId;
        }
      );

      return articles;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`News API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  getArticle(id: string): NewsArticle | undefined {
    return this.articleCache.get(id);
  }

  getAllArticles(): NewsArticle[] {
    return Array.from(this.articleCache.values());
  }
}
