import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import {
  PerplexitySearchArgs,
  PerplexitySearchResult,
} from "../../types/perplexity.js";

dotenv.config();

export class PerplexityManager {
  private apiKey: string;
  private searchCache: Map<string, PerplexitySearchResult>;

  constructor(private server: Server) {
    this.apiKey = process.env.PERPLEXITY_API_KEY || "";
    this.searchCache = new Map();

    if (!this.apiKey) {
      console.warn("PERPLEXITY_API_KEY environment variable is not set");
    }
  }

  async search(args: PerplexitySearchArgs): Promise<PerplexitySearchResult> {
    if (!this.apiKey) {
      throw new Error("PERPLEXITY_API_KEY environment variable is required");
    }

    try {
      const response = await axios.post(
        "https://api.perplexity.ai/chat/completions",
        {
          model: "llama-3.1-sonar-large-128k-online",
          messages: [
            {
              role: "system",
              content: `You are a helpful research assistant focused on providing accurate, well-researched information. Focus area: ${
                args.focus || "internet"
              }. Please be thorough but concise.`,
            },
            {
              role: "user",
              content: args.query,
            },
          ],
          temperature: 0.2,
          top_p: 0.9,
          return_citations: args.return_citations ?? true,
          search_domain_filter: args.search_domain_filter,
          search_recency_filter: args.search_recency_filter,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result: PerplexitySearchResult = {
        id: `search-${Date.now()}`,
        text: response.data.choices[0].message.content,
        citations: response.data.choices[0].message.citations || [],
        timestamp: new Date().toISOString(),
      };

      this.searchCache.set(result.id, result);
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error(
            "Invalid or expired API key. Please check your PERPLEXITY_API_KEY environment variable."
          );
        }
        throw new Error(
          `API request failed with status ${error.response?.status}: ${error.message}`
        );
      }
      throw new Error(
        `Unexpected error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  getSearchResult(id: string): PerplexitySearchResult | undefined {
    return this.searchCache.get(id);
  }

  getAllSearchResults(): PerplexitySearchResult[] {
    return Array.from(this.searchCache.values());
  }
}
