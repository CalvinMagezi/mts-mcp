export interface NotionDatabase {
  id: string;
  title: string;
  description?: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  content?: string;
  properties?: Record<string, any>;
}

export interface SearchArgs {
  query: string;
  limit?: number;
}

export interface DatabaseContentArgs {
  database_id: string;
  limit?: number;
}

export interface CreatePageArgs {
  parent_id: string;
  title: string;
  content?: string;
  properties?: Record<string, any>;
}

export interface UpdatePageArgs {
  page_id: string;
  title?: string;
  content?: string;
  properties?: Record<string, any>;
}

export interface GetPageContentArgs {
  page_id: string;
}

export interface ContentChunk {
  type: string;
  content: string;
}

export interface RichTextContent {
  type: "text" | "mention" | "equation" | "link";
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  mention?: {
    type: "user" | "page" | "database" | "date";
    [key: string]: any;
  };
  equation?: {
    expression: string;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

export interface BlockContent {
  type: string;
  content: string | RichTextContent[];
  children?: BlockContent[];
}
