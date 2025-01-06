import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@notionhq/client";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  SearchArgs,
  DatabaseContentArgs,
  CreatePageArgs,
  UpdatePageArgs,
  GetPageContentArgs,
  ContentChunk,
} from "../../types/notion.js";

export class NotionManager {
  private notion: Client;

  constructor(private server: Server) {
    const NOTION_KEY = process.env.NOTION_API_KEY;
    if (!NOTION_KEY) {
      throw new Error("NOTION_API_KEY environment variable is required");
    }

    this.notion = new Client({ auth: NOTION_KEY });
  }

  async search(args: SearchArgs) {
    const results = await this.notion.search({
      query: args.query,
      page_size: args.limit || 10,
    });

    return results.results.map((item) => ({
      id: item.id,
      type: item.object,
      title: this.getPageTitle(item),
      url:
        "object" in item && item.object === "page" && "url" in item
          ? item.url
          : null,
    }));
  }

  async getDatabaseContent(args: DatabaseContentArgs) {
    const results = await this.notion.databases.query({
      database_id: args.database_id,
      page_size: args.limit || 10,
    });

    return results.results.map((page) => ({
      id: page.id,
      title: this.getPageTitle(page),
      url:
        "object" in page && page.object === "page" && "url" in page
          ? page.url
          : null,
      created_time: "created_time" in page ? page.created_time : null,
      last_edited_time:
        "last_edited_time" in page ? page.last_edited_time : null,
    }));
  }

  async createPage(args: CreatePageArgs) {
    try {
      let parentId = args.parent_id;
      if (!parentId) {
        parentId = await this.findMostRelevantParentPage(
          args.title,
          args.content
        );
      }

      const pageData: any = {
        parent: {
          type: "page_id",
          page_id: parentId,
        },
        properties: {
          title: {
            type: "title",
            title: this.processRichText(args.title),
          },
          ...args.properties,
        },
      };

      if (args.content) {
        pageData.children = await this.convertContentToBlocks(args.content);
      }

      const response = await this.notion.pages.create(pageData);

      return {
        id: response.id,
        url: (response as any).url || null,
        title: this.getPageTitle(response),
        parent_id: parentId,
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Error creating page: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updatePage(args: UpdatePageArgs) {
    const updates: any = { properties: {} };

    if (args.title) {
      updates.properties.title = {
        title: [{ text: { content: args.title } }],
      };
    }

    if (args.properties) {
      updates.properties = {
        ...updates.properties,
        ...args.properties,
      };
    }

    const response = await this.notion.pages.update({
      page_id: args.page_id,
      ...updates,
    });

    if (args.content) {
      await this.notion.blocks.children.append({
        block_id: args.page_id,
        children: await this.convertContentToBlocks(args.content),
      });
    }

    return {
      id: response.id,
      url: (response as any).url || null,
      title: this.getPageTitle(response),
    };
  }

  async getPageContent(args: GetPageContentArgs) {
    const page = await this.notion.pages.retrieve({ page_id: args.page_id });
    const blocks = await this.notion.blocks.children.list({
      block_id: args.page_id,
    });

    return {
      id: page.id,
      title: this.getPageTitle(page),
      url: (page as any).url || null,
      content: blocks.results,
      properties: (page as any).properties || null,
    };
  }

  async listDatabases() {
    const databases = await this.notion.databases.list({
      page_size: 100,
    });

    return databases.results.map((db) => ({
      uri: `notion://database/${db.id}`,
      name: this.getDatabaseTitle(db),
      mimeType: "application/json",
      description: "Notion database content",
    }));
  }

  // Helper methods
  private getDatabaseTitle(database: any): string {
    try {
      return database.title[0]?.plain_text || "Untitled Database";
    } catch {
      return "Untitled Database";
    }
  }

  private getPageTitle(page: any): string {
    try {
      if (page.properties?.title) {
        return page.properties.title.title[0]?.plain_text || "Untitled";
      }
      if (page.properties?.Name) {
        return page.properties.Name.title[0]?.plain_text || "Untitled";
      }
      return "Untitled";
    } catch {
      return "Untitled";
    }
  }

  private async findMostRelevantParentPage(
    title: string,
    content?: string
  ): Promise<string> {
    try {
      const searchQuery = [title, content?.split(" ").slice(0, 5).join(" ")]
        .filter(Boolean)
        .join(" ");

      const searchResults = await this.notion.search({
        query: searchQuery,
        filter: { property: "object", value: "page" },
        page_size: 5,
      });

      if (searchResults.results.length > 0) {
        return searchResults.results[0].id;
      }

      const workspaceSearch = await this.notion.search({
        query: "AI Workspace Research Notes",
        filter: { property: "object", value: "page" },
        page_size: 1,
      });

      if (workspaceSearch.results.length > 0) {
        return workspaceSearch.results[0].id;
      }

      const newWorkspace = await this.notion.pages.create({
        parent: {
          type: "page_id",
          page_id: await this.getFirstAccessiblePage(),
        },
        properties: {
          title: {
            type: "title",
            title: [
              { type: "text", text: { content: "AI Assistant Workspace" } },
            ],
          },
        },
      });

      return newWorkspace.id;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        "Failed to find or create parent page"
      );
    }
  }

  private async getFirstAccessiblePage(): Promise<string> {
    const results = await this.notion.search({ page_size: 1 });
    if (results.results.length === 0) {
      throw new McpError(ErrorCode.InternalError, "No accessible pages found");
    }
    return results.results[0].id;
  }

  private processRichText(
    content: string
  ): Array<{ type: "text"; text: { content: string } }> {
    return [{ type: "text", text: { content } }];
  }

  private async convertContentToBlocks(content: string): Promise<any[]> {
    const BLOCK_CHAR_LIMIT = 2000;
    const blocks: any[] = [];

    const paragraphs = content.split(/\n\n+/);
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        let remainingContent = paragraph;
        while (remainingContent.length > 0) {
          const chunk = remainingContent.slice(0, BLOCK_CHAR_LIMIT);
          blocks.push({
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: chunk } }],
            },
          });
          remainingContent = remainingContent.slice(BLOCK_CHAR_LIMIT);
        }
      }
    }

    return blocks;
  }
}
