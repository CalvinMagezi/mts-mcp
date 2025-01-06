import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";

export class SinglePageScraper {
  async scrapePage(url: string): Promise<string> {
    const browser = await puppeteer.launch({ headless: "new" });

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle0" });
      const html = await page.content();

      const $ = cheerio.load(html);

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
    } finally {
      await browser.close();
    }
  }
}
