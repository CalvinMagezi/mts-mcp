import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";
import URLParse from "url-parse";

export class DocumentationScraper {
  private baseUrl: string;
  private visited: Set<string> = new Set();
  private queue: string[] = [];
  private domain: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    const parsedUrl = new URLParse(baseUrl);
    this.domain = parsedUrl.hostname;
  }

  async scrapeDocumentation(): Promise<{ url: string; content: string }[]> {
    const browser = await puppeteer.launch({ headless: "new" });
    const results: { url: string; content: string }[] = [];

    try {
      this.queue.push(this.baseUrl);

      while (this.queue.length > 0) {
        const url = this.queue.shift()!;
        if (this.visited.has(url)) continue;

        const page = await browser.newPage();
        try {
          await page.goto(url, { waitUntil: "networkidle0" });
          const html = await page.content();
          const $ = cheerio.load(html);

          // Extract main content
          const content = this.extractContent($);
          if (content) {
            results.push({ url, content });
          }

          // Find and queue new links
          const links = this.extractLinks($);
          this.queueNewLinks(links);

          this.visited.add(url);
        } catch (error) {
          console.error(`Error processing ${url}:`, error);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }

    return results;
  }

  private extractContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $("script, style, nav, footer, header").remove();

    // Find main content area
    const mainContent =
      $("main").html() ||
      $("article").html() ||
      $(".content").html() ||
      $(".documentation").html() ||
      $("body").html();

    if (!mainContent) return "";

    // Convert HTML to Markdown
    return NodeHtmlMarkdown.translate(mainContent);
  }

  private extractLinks($: cheerio.CheerioAPI): string[] {
    const links: string[] = [];
    $("a").each((_, element) => {
      const href = $(element).attr("href");
      if (href) {
        try {
          const url = new URL(href, this.baseUrl);
          if (url.hostname === this.domain) {
            links.push(url.href);
          }
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });
    return links;
  }

  private queueNewLinks(links: string[]) {
    for (const link of links) {
      if (!this.visited.has(link) && !this.queue.includes(link)) {
        this.queue.push(link);
      }
    }
  }
}
