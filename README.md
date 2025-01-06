# MTS MCP's and Agents

A comprehensive suite of Model Context Protocol (MCP) servers and specialized AI agents designed to enhance Claude's capabilities with various integrations and analytical tools.

## Overview

This project provides a collection of MCP servers and specialized agents that extend Claude's functionality across different domains:

### MCP Capabilities

- **Nexus Knowledge Graph**: Manages and stores knowledge in a graph structure with entities and relationships
- **Reasoning Engine**: Provides structured reasoning capabilities including:

  - Analysis and decomposition of complex problems
  - Hypothesis generation and validation
  - Sequential reasoning with branching
  - Synthesis of multiple reasoning steps
  - Validation against specific criteria

- **Perplexity Integration**: Advanced AI-powered search capabilities with:

  - Focus-specific searches (internet, academic, writing, math, coding)
  - Citation tracking and verification
  - Domain and recency filtering options

- **News Integration**: Real-time news data access with:

  - Keyword-based news search
  - Category filtering (business, technology, etc.)
  - Headlines and detailed article content

- **Notion Integration**: Workspace integration features:
  - Search across Notion workspace
  - Database content retrieval
  - Page content management

### Specialized Agents

- **Coding Agent**: Advanced software development assistant with:

  - Next.js and TypeScript expertise
  - Access to multiple MCP capabilities
  - Best practices enforcement
  - Automated testing support

- **Research Agent**: Technical research and analysis assistant with:

  - Multi-faceted technical research capabilities
  - Trend identification and analysis
  - Systematic literature review
  - Evidence-based validation
  - Comprehensive research synthesis
  - Market and technology evaluation

- **Documentation Agent**: Technical documentation specialist with:
  - Comprehensive documentation management
  - Knowledge organization and structuring
  - Technical content creation and maintenance
  - Documentation standards enforcement
  - Version tracking and updates
  - Cross-platform documentation sync

## Prerequisites

- Node.js v18 or higher
- Bun package manager
- Claude Desktop application
- Relevant API keys for different integrations

## Installation

1. Clone the repository:

```bash
git clone https://github.com/calvinmagezi/mts-mcp.git
cd mts-mcp
```

2. Install dependencies:

```bash
bun install
```

3. Build the server:

```bash
bun run build
```

## Development

For development with auto-rebuild:

```bash
bun run watch
```

### MCP Server Configuration

To use with Claude Desktop, add the server config:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "master-mcp": {
      "command": "/path/to/master-mcp/build/index.js"
    }
  }
}
```

### Debugging

MCP servers communicate over stdio. For debugging, use the MCP Inspector:

```bash
bun run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
