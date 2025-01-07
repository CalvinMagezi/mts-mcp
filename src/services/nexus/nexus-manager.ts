import fs from "fs/promises";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DocumentationScraper } from "./documentation-scraper.js";
import { SinglePageScraper } from "./single-page-scraper.js";
import {
  CreateEntitiesArgs,
  CreateRelationsArgs,
  NexusNode,
  NexusLink,
} from "../../types/nexus.js";

export class NexusManager {
  private nodes: Map<string, NexusNode>;
  private links: NexusLink[];
  private server: Server;
  private dataDir: string;
  private documentationScraper: DocumentationScraper | null = null;
  private singlePageScraper: SinglePageScraper;

  constructor(server: Server) {
    this.server = server;
    this.nodes = new Map();
    this.links = [];
    // Change from absolute path to relative path
    this.dataDir = path.join(process.cwd(), "data");
    this.singlePageScraper = new SinglePageScraper();
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.loadData();
    } catch (error) {
      console.error("Error initializing storage:", error);
    }
  }

  private async loadData() {
    try {
      const nodesData = await fs.readFile(
        path.join(this.dataDir, "nodes.json"),
        "utf-8"
      );
      const linksData = await fs.readFile(
        path.join(this.dataDir, "links.json"),
        "utf-8"
      );

      const nodes = JSON.parse(nodesData);
      this.nodes = new Map(Object.entries(nodes));
      this.links = JSON.parse(linksData);
    } catch (error) {
      // If files don't exist, start with empty data
      this.nodes = new Map();
      this.links = [];
    }
  }

  private async saveData() {
    try {
      const nodesObj = Object.fromEntries(this.nodes);
      await fs.writeFile(
        path.join(this.dataDir, "nodes.json"),
        JSON.stringify(nodesObj, null, 2)
      );
      await fs.writeFile(
        path.join(this.dataDir, "links.json"),
        JSON.stringify(this.links, null, 2)
      );
    } catch (error) {
      console.error("Error saving data:", error);
    }
  }

  async clearNexus(confirmation: boolean): Promise<void> {
    if (!confirmation) {
      throw new Error("Confirmation required to clear Nexus");
    }
    this.nodes.clear();
    this.links = [];
    await this.saveData();
  }

  async createEntities(args: CreateEntitiesArgs): Promise<void> {
    for (const entity of args.entities) {
      const node: NexusNode = {
        id: entity.name,
        type: entity.nodeType,
        insights: entity.insights || [],
      };
      this.nodes.set(node.id, node);
    }
    await this.saveData();
  }

  async createRelations(args: CreateRelationsArgs): Promise<void> {
    for (const relation of args.relations) {
      if (!this.nodes.has(relation.from) || !this.nodes.has(relation.to)) {
        throw new Error("Source or target node not found");
      }

      const link: NexusLink = {
        id: `${relation.from}-${relation.linkType}-${relation.to}`,
        source: relation.from,
        target: relation.to,
        type: relation.linkType,
      };
      this.links.push(link);
    }
    await this.saveData();
  }

  async scrapeDocumentation(baseUrl: string): Promise<void> {
    this.documentationScraper = new DocumentationScraper(baseUrl);
    const results = await this.documentationScraper.scrapeDocumentation();

    for (const result of results) {
      const node: NexusNode = {
        id: result.url,
        type: "documentation",
        insights: [result.content],
      };
      this.nodes.set(node.id, node);
    }
    await this.saveData();
  }

  async scrapePage(url: string): Promise<void> {
    const content = await this.singlePageScraper.scrapePage(url);
    const node: NexusNode = {
      id: url,
      type: "page",
      insights: [content],
    };
    this.nodes.set(node.id, node);
    await this.saveData();
  }

  async getNodes(): Promise<NexusNode[]> {
    return Array.from(this.nodes.values());
  }

  async getLinks(): Promise<NexusLink[]> {
    return this.links;
  }

  async getNode(id: string): Promise<NexusNode | undefined> {
    return this.nodes.get(id);
  }

  async searchNodes(query: string): Promise<NexusNode[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.nodes.values()).filter((node) => {
      return (
        node.id.toLowerCase().includes(searchTerm) ||
        node.insights.some((insight) =>
          insight.toLowerCase().includes(searchTerm)
        )
      );
    });
  }

  async addInsight(nodeId: string, insight: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    node.insights.push(insight);
    await this.saveData();
  }

  async updateNode(nodeId: string, updates: Partial<NexusNode>): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const updatedNode = {
      ...node,
      ...updates,
      id: nodeId, // Ensure ID cannot be changed
    };

    this.nodes.set(nodeId, updatedNode);
    await this.saveData();
  }

  async deleteNode(nodeId: string): Promise<void> {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} not found`);
    }

    this.nodes.delete(nodeId);
    this.links = this.links.filter(
      (link) => link.source !== nodeId && link.target !== nodeId
    );
    await this.saveData();
  }

  async deleteLink(linkId: string): Promise<void> {
    const linkIndex = this.links.findIndex((link) => link.id === linkId);
    if (linkIndex === -1) {
      throw new Error(`Link ${linkId} not found`);
    }

    this.links.splice(linkIndex, 1);
    await this.saveData();
  }

  async getNodeConnections(nodeId: string): Promise<{
    incoming: NexusLink[];
    outgoing: NexusLink[];
  }> {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const incoming = this.links.filter((link) => link.target === nodeId);
    const outgoing = this.links.filter((link) => link.source === nodeId);

    return { incoming, outgoing };
  }

  async findPath(
    startNodeId: string,
    endNodeId: string,
    maxDepth = 5
  ): Promise<NexusLink[]> {
    if (!this.nodes.has(startNodeId) || !this.nodes.has(endNodeId)) {
      throw new Error("Start or end node not found");
    }

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: NexusLink[] }> = [
      { nodeId: startNodeId, path: [] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (path.length >= maxDepth) continue;
      if (nodeId === endNodeId) return path;

      if (!visited.has(nodeId)) {
        visited.add(nodeId);

        const outgoingLinks = this.links.filter(
          (link) => link.source === nodeId
        );
        for (const link of outgoingLinks) {
          if (!visited.has(link.target)) {
            queue.push({
              nodeId: link.target,
              path: [...path, link],
            });
          }
        }
      }
    }

    return [];
  }

  // Add any additional methods you need here
}
