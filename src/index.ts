#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  RequestSchema,
  ResultSchema,
  NotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NexusManager } from "./services/nexus/nexus-manager.js";
import { ReasoningManager } from "./services/reasoning/reasoning-manager.js";
import {
  CreateReasoningStepArgs,
  AnalyzeArgs,
  ReasoningType,
  SynthesizeArgs,
  ValidateArgs,
  SequentialReasoningArgs,
} from "./types/reasoning.js";
import { PerplexityManager } from "./services/perplexity/perplexity-manager.js";
import { PerplexitySearchArgs } from "./types/perplexity.js";
import { GetHeadlinesArgs, NewsManager } from "./services/news/news-manager.js";
import { NotionManager } from "./services/notion/notion-manager.js";

// Initialize the server with proper types
const server = new Server<
  (typeof RequestSchema)["_output"],
  (typeof NotificationSchema)["_output"],
  (typeof ResultSchema)["_output"]
>(
  {
    name: "mts-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      sampling: {},
      resources: {},
      notifications: {
        listChanged: true,
      },
    },
  }
);

// Initialize managers
const nexusManager = new NexusManager(server);
const reasoningManager = new ReasoningManager(server);
const perplexityManager = new PerplexityManager(server);
const newsManager = new NewsManager(server);
const notionManager = new NotionManager(server);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Nexus Tools
      {
        name: "clear_nexus",
        description: "Clear all stored knowledge from the Nexus system",
        inputSchema: {
          type: "object",
          properties: {
            confirmation: {
              type: "boolean",
              description: "Confirm that you want to clear all Nexus data",
            },
          },
          required: ["confirmation"],
        },
      },
      {
        name: "create_entities",
        description: "Create multiple new entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "The name of the entity",
                  },
                  nodeType: {
                    type: "string",
                    description: "The type of the entity",
                  },
                  insights: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "An array of observation contents associated with the entity",
                  },
                },
                required: ["name", "nodeType", "insights"],
              },
            },
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: {
                    type: "string",
                    description: "Name of the source entity",
                  },
                  to: {
                    type: "string",
                    description: "Name of the target entity",
                  },
                  linkType: {
                    type: "string",
                    description: "Type of the relation",
                  },
                },
                required: ["from", "to", "linkType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      // Reasoning Tools
      {
        name: "create_reasoning_step",
        description: "Create a new reasoning step",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "hypothesis",
                "analysis",
                "inference",
                "conclusion",
                "counterargument",
                "synthesis",
                "decomposition",
                "validation",
                "revision",
                "branch",
                "question",
                "realization",
              ],
              description: "Type of reasoning step",
            },
            content: {
              type: "string",
              description: "Content of the reasoning step",
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "IDs of dependent reasoning steps",
            },
            evidence: {
              type: "array",
              items: { type: "string" },
              description: "Supporting evidence or references",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence level (0-1)",
            },
          },
          required: ["type", "content"],
        },
      },
      {
        name: "analyze",
        description: "Perform deep analysis using structured reasoning",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt to analyze",
            },
            depth: {
              type: "number",
              description: "Depth of analysis (1-5)",
              minimum: 1,
              maximum: 5,
            },
            focus_areas: {
              type: "array",
              items: { type: "string" },
              description: "Specific areas to focus analysis on",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "scrape_documentation",
        description: "Scrape documentation from a website",
        inputSchema: {
          type: "object",
          properties: {
            baseUrl: {
              type: "string",
              description: "The base URL of the documentation to scrape",
            },
          },
          required: ["baseUrl"],
        },
      },
      {
        name: "scrape_page",
        description: "Scrape content from a single webpage",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the page to scrape",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "synthesize",
        description: "Synthesize multiple reasoning steps into a new insight",
        inputSchema: {
          type: "object",
          properties: {
            step_ids: {
              type: "array",
              items: { type: "string" },
              description: "IDs of steps to synthesize",
            },
            perspective: {
              type: "string",
              description: "Optional perspective for synthesis",
            },
          },
          required: ["step_ids"],
        },
      },
      {
        name: "validate",
        description: "Validate a reasoning step against given criteria",
        inputSchema: {
          type: "object",
          properties: {
            step_id: {
              type: "string",
              description: "ID of the step to validate",
            },
            criteria: {
              type: "array",
              items: { type: "string" },
              description: "Validation criteria",
            },
          },
          required: ["step_id"],
        },
      },
      {
        name: "sequential_reasoning",
        description: "Perform sequential reasoning steps",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The initial prompt",
            },
            initialSteps: {
              type: "number",
              description: "Number of initial steps",
            },
            focusAreas: {
              type: "array",
              items: { type: "string" },
              description: "Areas to focus on",
            },
            branchId: {
              type: "string",
              description: "Optional branch ID",
            },
            branchFromStepId: {
              type: "string",
              description: "Optional step ID to branch from",
            },
          },
          required: ["prompt"],
        },
      },
      // Perplexity Tools
      {
        name: "search",
        description:
          "Search the internet using Perplexity AI with advanced research capabilities",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to perform",
            },
            focus: {
              type: "string",
              enum: ["internet", "academic", "writing", "math", "coding"],
              default: "internet",
              description: "The type of search to perform",
            },
            return_citations: {
              type: "boolean",
              default: true,
              description: "Whether to return source citations",
            },
            search_domain_filter: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of domains to restrict search to",
            },
            search_recency_filter: {
              type: "string",
              enum: ["day", "week", "month", "year"],
              description: "Optional time filter for search results",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_news",
        description: "Search for news articles using keywords and filters",
        inputSchema: {
          type: "object",
          properties: {
            q: {
              type: "string",
              description: "Keywords or phrases to search for",
            },
            language: {
              type: "string",
              description:
                "2-letter ISO-639-1 language code (e.g., en, es, fr)",
              default: "en",
            },
            sortBy: {
              type: "string",
              enum: ["relevancy", "popularity", "publishedAt"],
              default: "publishedAt",
            },
            pageSize: {
              type: "number",
              description: "Number of results to return (max 100)",
              default: 10,
            },
          },
          required: ["q"],
        },
      },
      {
        name: "get_headlines",
        description: "Get top headlines by country, category, or sources",
        inputSchema: {
          type: "object",
          properties: {
            country: {
              type: "string",
              description: "2-letter ISO 3166-1 country code",
            },
            category: {
              type: "string",
              enum: [
                "business",
                "entertainment",
                "general",
                "health",
                "science",
                "sports",
                "technology",
              ],
            },
            sources: {
              type: "string",
              description: "Comma-separated news sources",
            },
            pageSize: {
              type: "number",
              default: 10,
            },
          },
        },
      },
      // Notion Tools
      {
        name: "search_notion",
        description: "Search Notion pages and databases",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (1-100)",
              minimum: 1,
              maximum: 100,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_database_content",
        description: "Get contents of a specific Notion database",
        inputSchema: {
          type: "object",
          properties: {
            database_id: {
              type: "string",
              description: "Notion database ID",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (1-100)",
              minimum: 1,
              maximum: 100,
            },
          },
          required: ["database_id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: params } = request.params;

  if (!params || typeof params !== "object") {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Tool parameters are required and must be an object"
    );
  }

  try {
    // Helper function to create standardized tool responses
    const createToolResponse = (content: { type: string; text: string }[]) => ({
      _meta: {},
      content,
    });

    switch (toolName) {
      // Nexus Tools
      case "clear_nexus": {
        const confirmation = params.confirmation;
        if (typeof confirmation !== "boolean") {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Confirmation must be a boolean"
          );
        }
        await nexusManager.clearNexus(confirmation);
        return createToolResponse([
          { type: "text", text: "Nexus cleared successfully" },
        ]);
      }

      case "create_entities": {
        const { entities } = params as {
          entities: { name: string; nodeType: string; insights: string[] }[];
        };
        if (!Array.isArray(entities)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Entities must be an array"
          );
        }
        await nexusManager.createEntities({ entities });
        return createToolResponse([
          { type: "text", text: "Entities created successfully" },
        ]);
      }

      case "create_relations": {
        const { relations } = params as {
          relations: { from: string; to: string; linkType: string }[];
        };
        if (!Array.isArray(relations)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Relations must be an array"
          );
        }
        await nexusManager.createRelations({ relations });
        return createToolResponse([
          { type: "text", text: "Relations created successfully" },
        ]);
      }

      // Reasoning Tools
      case "create_reasoning_step": {
        const rawParams = params as Record<string, unknown>;
        const args: CreateReasoningStepArgs = {
          type: rawParams.type as ReasoningType,
          content: rawParams.content as string,
          dependencies: rawParams.dependencies as string[] | undefined,
          evidence: rawParams.evidence as string[] | undefined,
          confidence: rawParams.confidence as number | undefined,
        };

        if (!args.type || !args.content) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Valid type and content are required"
          );
        }

        const result = await reasoningManager.createReasoningStep(args);
        return createToolResponse([
          {
            type: "text",
            text: JSON.stringify(
              {
                step_id: result.content[0].text,
                type: args.type,
                content: args.content,
                confidence: args.confidence,
                evidence: args.evidence,
              },
              null,
              2
            ),
          },
        ]);
      }

      case "analyze": {
        const rawParams = params as Record<string, unknown>;
        const args: AnalyzeArgs = {
          prompt: rawParams.prompt as string,
          depth: rawParams.depth as number | undefined,
          focus_areas: rawParams.focus_areas as string[] | undefined,
        };

        if (!args.prompt) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Valid prompt is required"
          );
        }

        const result = await reasoningManager.analyze(args);
        return createToolResponse([
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ]);
      }

      case "scrape_documentation": {
        const { baseUrl } = params as { baseUrl: string };
        if (typeof baseUrl !== "string") {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Base URL must be a string"
          );
        }
        await nexusManager.scrapeDocumentation(baseUrl);
        return createToolResponse([
          { type: "text", text: "Documentation scraped successfully" },
        ]);
      }

      case "scrape_page": {
        const { url } = params as { url: string };
        if (typeof url !== "string") {
          throw new McpError(ErrorCode.InvalidRequest, "URL must be a string");
        }
        await nexusManager.scrapePage(url);
        return createToolResponse([
          { type: "text", text: "Page scraped successfully" },
        ]);
      }

      case "synthesize": {
        const rawParams = params as Record<string, unknown>;
        const args: SynthesizeArgs = {
          step_ids: rawParams.step_ids as string[],
          perspective: rawParams.perspective as string | undefined,
        };

        if (!args.step_ids?.length) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "At least one step ID is required"
          );
        }

        const result = await reasoningManager.synthesize(args);
        return createToolResponse([
          {
            type: "text",
            text: JSON.stringify(
              {
                synthesis_id: result.content[0].text,
                synthesized_steps: args.step_ids,
                perspective: args.perspective,
                result: result.content[0].text,
              },
              null,
              2
            ),
          },
        ]);
      }

      case "validate": {
        const rawParams = params as Record<string, unknown>;
        const args: ValidateArgs = {
          step_id: rawParams.step_id as string,
          criteria: rawParams.criteria as string[] | undefined,
        };

        if (!args.step_id) {
          throw new McpError(ErrorCode.InvalidRequest, "Step ID is required");
        }

        const result = await reasoningManager.validate(args);
        return createToolResponse(result.content);
      }

      case "sequential_reasoning": {
        const rawParams = params as Record<string, unknown>;
        const args: SequentialReasoningArgs = {
          prompt: rawParams.prompt as string,
          initialSteps: rawParams.initialSteps as number | undefined,
          focusAreas: rawParams.focusAreas as string[] | undefined,
          branchId: rawParams.branchId as string | undefined,
          branchFromStepId: rawParams.branchFromStepId as string | undefined,
        };

        if (!args.prompt) {
          throw new McpError(ErrorCode.InvalidRequest, "Prompt is required");
        }

        const result = await reasoningManager.sequentialReasoning(args);
        return createToolResponse([
          {
            type: "text",
            text: JSON.stringify(
              {
                steps: result.content[0].text,
                branch_id: args.branchId,
                total_steps: args.initialSteps || 3,
                prompt: args.prompt,
              },
              null,
              2
            ),
          },
        ]);
      }

      case "search": {
        const {
          query,
          focus,
          return_citations,
          search_domain_filter,
          search_recency_filter,
        } = params as Record<string, any>;
        if (!query) throw new Error("Search query is required");

        const searchParams: PerplexitySearchArgs = {
          query,
          focus,
          return_citations,
          search_domain_filter,
          search_recency_filter,
        };

        const result = await perplexityManager.search(searchParams);
        const formattedText = `${result.text}\n\nSources:\n${result.citations
          .map((citation, index) => `[${index + 1}] ${citation.url}`)
          .join("\n")}`;

        return createToolResponse([
          {
            type: "text",
            text: formattedText,
          },
        ]);
      }

      case "search_news": {
        const { q, language, sortBy, pageSize } = params as {
          q: string;
          language?: string;
          sortBy?: "relevancy" | "popularity" | "publishedAt";
          pageSize?: number;
        };
        const articles = await newsManager.searchNews({
          q,
          language,
          sortBy,
          pageSize,
        });
        return createToolResponse(
          articles.map((article, index) => ({
            type: "text",
            text: `[${index + 1}] ${article.title}\n${
              article.description || ""
            }\n`,
          }))
        );
      }

      case "get_headlines": {
        const articles = await newsManager.getHeadlines(
          params as GetHeadlinesArgs
        );
        return createToolResponse(
          articles.map((article, index) => ({
            type: "text",
            text: `[${index + 1}] ${article.title}\n${
              article.description || ""
            }\n`,
          }))
        );
      }

      case "search_notion": {
        const { query, limit } = params as {
          query: string;
          limit?: number;
        };
        const results = await notionManager.search({ query, limit });
        return createToolResponse(
          results.map((result, index) => ({
            type: "text",
            text: JSON.stringify(result, null, 2),
          }))
        );
      }

      case "get_database_content": {
        const { database_id, limit } = params as {
          database_id: string;
          limit?: number;
        };
        const results = await notionManager.getDatabaseContent({
          database_id,
          limit,
        });
        return createToolResponse(
          results.map((result, index) => ({
            type: "text",
            text: JSON.stringify(result, null, 2),
          }))
        );
      }

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown tool: ${toolName}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${toolName}: ${(error as Error).message}`
    );
  }
});

// Add resource handling for search results
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const searchResults = perplexityManager.getAllSearchResults();
  const newsArticles = newsManager.getAllArticles();

  return {
    resources: [
      ...searchResults.map((result) => ({
        uri: `perplexity://${result.id}`,
        mimeType: "text/plain",
        name: result.text.substring(0, 100) + "...",
        description: `Search performed at ${result.timestamp}`,
      })),
      ...newsArticles.map((article) => ({
        uri: `news://${article.id}`,
        mimeType: "text/plain",
        name: article.title,
        description: article.description || "No description available",
      })),
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);

  if (url.protocol === "perplexity:") {
    const id = url.hostname;
    const result = perplexityManager.getSearchResult(id);

    if (!result) {
      throw new Error(`Search result ${id} not found`);
    }

    const fullContent = [
      `Search Result ID: ${result.id}`,
      `Timestamp: ${result.timestamp}`,
      "",
      result.text,
      "",
      "Citations:",
      ...result.citations.map(
        (citation, index) => `[${index + 1}] ${citation.url}\n${citation.text}`
      ),
    ].join("\n");

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "text/plain",
          text: fullContent,
        },
      ],
    };
  }

  if (url.protocol === "news:") {
    const id = url.hostname;
    const article = newsManager.getArticle(id);

    if (!article) {
      throw new Error(`News article ${id} not found`);
    }

    const fullContent = [
      `Title: ${article.title}`,
      `Author: ${article.author || "Unknown"}`,
      `Published: ${article.publishedAt}`,
      `Source: ${article.source.name}`,
      `URL: ${article.url}`,
      "",
      article.content || article.description || "No content available",
    ].join("\n");

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "text/plain",
          text: fullContent,
        },
      ],
    };
  }

  return { contents: [] };
});

// Set up error handling
server.onerror = (error) => {
  console.error("[MCP Error]", error);
};

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
