import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

// Convert exec to promise-based
const execAsync = promisify(exec);

// Supported package managers and their commands
const PACKAGE_MANAGERS = {
  npm: {
    install: "npm install",
    uninstall: "npm uninstall",
    installDev: "npm install --save-dev",
    list: "npm list --depth=0",
  },
  yarn: {
    install: "yarn add",
    uninstall: "yarn remove",
    installDev: "yarn add --dev",
    list: "yarn list --depth=0",
  },
  pnpm: {
    install: "pnpm add",
    uninstall: "pnpm remove",
    installDev: "pnpm add -D",
    list: "pnpm list --depth=0",
  },
  bun: {
    install: "bun add",
    uninstall: "bun remove",
    installDev: "bun add -d",
    list: "bun list --depth=0",
  },
  nextjs: {
    create: "bunx create-next-app@latest",
  },
};

// Validate package names to prevent command injection
function isValidPackageName(name: string): boolean {
  return /^[@a-zA-Z0-9-_/.]+$/.test(name);
}

// Add this new function to handle interactive commands
async function executeInteractiveCommand(
  command: string,
  inputs: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(command);

    let output = "";
    let currentQuestion = "";

    // Handle command output
    child.stdout?.on("data", (data) => {
      const text = data.toString();
      output += text;
      currentQuestion += text;

      // Check if we have an answer for the current question
      Object.entries(inputs).forEach(([question, answer]) => {
        if (currentQuestion.toLowerCase().includes(question.toLowerCase())) {
          child.stdin?.write(`${answer}\n`);
          currentQuestion = "";
        }
      });
    });

    child.stderr?.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}\n${output}`));
      }
    });

    // Handle any errors
    child.on("error", (error) => {
      reject(error);
    });
  });
}

export class PackageManagerServer {
  private server: Server;
  private currentWorkingDir: string;

  constructor() {
    this.server = new Server(
      {
        name: "package-manager-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Default to current directory
    this.currentWorkingDir = process.cwd();

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    this.setupResourceHandlers();
    this.setupToolHandlers();
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "packages://installed",
          name: "Installed Packages",
          mimeType: "application/json",
          description: "List of currently installed packages in the project",
        },
      ],
    }));

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        if (request.params.uri !== "packages://installed") {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unknown resource: ${request.params.uri}`
          );
        }

        try {
          // Try npm list first, fallback to other package managers if needed
          const { stdout } = await execAsync(PACKAGE_MANAGERS.npm.list, {
            cwd: this.currentWorkingDir,
          });

          return {
            contents: [
              {
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify({ packages: stdout }, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to list packages: ${error.message}`
          );
        }
      }
    );
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "manage_packages",
          description: "Install or uninstall packages using npm/yarn/pnpm/bun",
          inputSchema: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                enum: ["install", "uninstall"],
                description: "Operation to perform",
              },
              packages: {
                type: "array",
                items: { type: "string" },
                description: "Package names",
              },
              packageManager: {
                type: "string",
                enum: ["npm", "yarn", "pnpm", "bun"],
                default: "bun",
                description: "Package manager to use",
              },
              dev: {
                type: "boolean",
                default: false,
                description: "Install as dev dependency",
              },
            },
            required: ["operation", "packages"],
          },
        },
        {
          name: "set_working_directory",
          description: "Set the working directory for package operations",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Path to working directory",
              },
            },
            required: ["path"],
          },
        },
        {
          name: "create_nextjs_app",
          description:
            "Create a new Next.js application with interactive setup",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "Path where the Next.js project should be created",
              },
              answers: {
                type: "object",
                description: "Answers to the setup questions",
                properties: {
                  "What is your project named?": {
                    type: "string",
                    description: "The name of your Next.js project",
                  },
                  "Would you like to use TypeScript?": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "Yes",
                  },
                  "Would you like to use ESLint?": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "Yes",
                  },
                  "Would you like to use Tailwind CSS?": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "Yes",
                  },
                  "Would you like your code inside a `src/` directory?": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "Yes",
                  },
                  "Would you like to use App Router? (recommended)": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "Yes",
                  },
                  "Would you like to use Turbopack for `next dev`?": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "No",
                  },
                  "Would you like to customize the import alias ('*' (see below for file content) by default)?": {
                    type: "string",
                    enum: ["No", "Yes"],
                    default: "No",
                  },
                },
                required: ["What is your project named?"],
            },
          },
          required: ["projectPath", "answers"],
        },
      },
    ],
  }));

  public async handleToolRequest(toolName: string, params: Record<string, any>) {
    try {
      // Helper function to create standardized tool responses
      const createToolResponse = (content: { type: string; text: string }[]) => ({
        _meta: {},
        content,
      });

      switch (toolName) {
        case "manage_packages": {
          const {
            operation,
            packages,
            packageManager = "bun",
            dev = false,
          } = params as {
            operation: "install" | "uninstall";
            packages: string[];
            packageManager?: keyof typeof PACKAGE_MANAGERS;
            dev?: boolean;
          };

          // Validate all package names
          if (!packages.every(isValidPackageName)) {
            return createToolResponse([
              {
                type: "text",
                text: "Invalid package name found. Package names can only contain letters, numbers, @, -, _, /, and .",
              },
            ]);
          }

          try {
            const pm = PACKAGE_MANAGERS[packageManager as keyof typeof PACKAGE_MANAGERS];
            if (!pm) {
              throw new Error(
                `Package manager ${packageManager} is not supported`
              );
            }
            if (!("install" in pm)) {
              throw new Error(
                `Package manager ${packageManager} doesn't support this operation`
              );
            }

            const command =
              operation === "install"
                ? dev
                  ? pm.installDev
                  : pm.install
                : pm.uninstall;

            const { stdout, stderr } = await execAsync(
              `${command} ${packages.join(" ")}`,
              { cwd: this.currentWorkingDir }
            );

            return createToolResponse([
              {
                type: "text",
                text: stdout + stderr,
              },
            ]);
          } catch (error: any) {
            return createToolResponse([
              {
                type: "text",
                text: `Command failed: ${error.message}`,
              },
            ]);
          }
        }

        case "set_working_directory": {
          const { path } = params as { path: string };
          this.currentWorkingDir = path;
          return createToolResponse([
            {
              type: "text",
              text: `Working directory set to: ${path}`,
            },
          ]);
        }

        case "create_nextjs_app": {
          const { projectPath, answers } = params as {
            projectPath: string;
            answers: Record<string, string>;
          };

          try {
            // Change to the target directory
            const originalDir = process.cwd();
            process.chdir(projectPath);

            // Execute the create-next-app command
            const command = PACKAGE_MANAGERS.nextjs.create;
            const output = await executeInteractiveCommand(command, answers);

            // Change back to the original directory
            process.chdir(originalDir);

            return createToolResponse([
              {
                type: "text",
                text: output,
              },
            ]);
          } catch (error: any) {
            return createToolResponse([
              {
                type: "text",
                text: `Failed to create Next.js app: ${error.message}`,
              },
            ]);
          }
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
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
  }
