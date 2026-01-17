#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";

// Types
interface Report {
  id: string;
  name: string;
  type: "sovereign" | "quasi-sovereign";
  status: "pending" | "in-progress" | "completed";
  description?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ReportsData {
  reports: Report[];
}

// Paths
const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Ensure directories exist
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Load reports from JSON file
function loadReports(): ReportsData {
  ensureDataDir();
  if (!fs.existsSync(REPORTS_FILE)) {
    const initial: ReportsData = { reports: [] };
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const content = fs.readFileSync(REPORTS_FILE, "utf-8");
  return JSON.parse(content);
}

// Save reports to JSON file
function saveReports(data: ReportsData): void {
  ensureDataDir();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2));

  // Also save as markdown for easy viewing
  const markdown = generateMarkdown(data);
  fs.writeFileSync(path.join(DATA_DIR, "reports.md"), markdown);
}

// Generate markdown from reports
function generateMarkdown(data: ReportsData): string {
  let md = "# Sovereign & Quasi-Sovereign Reports\n\n";

  const sovereigns = data.reports.filter(r => r.type === "sovereign");
  const quasiSovereigns = data.reports.filter(r => r.type === "quasi-sovereign");

  md += "## Sovereign Reports\n\n";
  if (sovereigns.length === 0) {
    md += "_No sovereign reports yet_\n\n";
  } else {
    md += "| Name | Status | Description | Attachments |\n";
    md += "|------|--------|-------------|-------------|\n";
    for (const r of sovereigns) {
      const attachCount = r.attachments?.length || 0;
      md += `| ${r.name} | ${r.status} | ${r.description || "-"} | ${attachCount} files |\n`;
    }
    md += "\n";
  }

  md += "## Quasi-Sovereign Reports\n\n";
  if (quasiSovereigns.length === 0) {
    md += "_No quasi-sovereign reports yet_\n\n";
  } else {
    md += "| Name | Status | Description | Attachments |\n";
    md += "|------|--------|-------------|-------------|\n";
    for (const r of quasiSovereigns) {
      const attachCount = r.attachments?.length || 0;
      md += `| ${r.name} | ${r.status} | ${r.description || "-"} | ${attachCount} files |\n`;
    }
    md += "\n";
  }

  return md;
}

// Generate unique ID
function generateId(): string {
  return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create MCP Server
function createServer() {
  const server = new Server(
    {
      name: "sov-quasi-reports",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "list_reports",
          description: "List all reports, optionally filtered by type or status",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["sovereign", "quasi-sovereign"],
                description: "Filter by report type",
              },
              status: {
                type: "string",
                enum: ["pending", "in-progress", "completed"],
                description: "Filter by status",
              },
            },
          },
        },
        {
          name: "add_report",
          description: "Add a new report to the list",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the report",
              },
              type: {
                type: "string",
                enum: ["sovereign", "quasi-sovereign"],
                description: "Type of report",
              },
              description: {
                type: "string",
                description: "Optional description of the report",
              },
            },
            required: ["name", "type"],
          },
        },
        {
          name: "update_report",
          description: "Update an existing report",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Report ID",
              },
              name: {
                type: "string",
                description: "New name for the report",
              },
              status: {
                type: "string",
                enum: ["pending", "in-progress", "completed"],
                description: "New status",
              },
              description: {
                type: "string",
                description: "New description",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "delete_report",
          description: "Delete a report",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Report ID to delete",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "upload_file",
          description: "Upload a file (as base64) and attach it to a report. Useful for uploading documents from mobile.",
          inputSchema: {
            type: "object",
            properties: {
              reportId: {
                type: "string",
                description: "Report ID to attach the file to",
              },
              filename: {
                type: "string",
                description: "Name of the file",
              },
              contentBase64: {
                type: "string",
                description: "File content encoded as base64",
              },
            },
            required: ["reportId", "filename", "contentBase64"],
          },
        },
        {
          name: "list_attachments",
          description: "List all attachments for a report",
          inputSchema: {
            type: "object",
            properties: {
              reportId: {
                type: "string",
                description: "Report ID",
              },
            },
            required: ["reportId"],
          },
        },
      ],
    };
  });

  // List resources (the reports list)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "reports://list",
          name: "Reports List",
          description: "Current list of all sovereign and quasi-sovereign reports",
          mimeType: "application/json",
        },
        {
          uri: "reports://markdown",
          name: "Reports Markdown",
          description: "Reports formatted as markdown",
          mimeType: "text/markdown",
        },
      ],
    };
  });

  // Read resources
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "reports://list") {
      const data = loadReports();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (uri === "reports://markdown") {
      const data = loadReports();
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: generateMarkdown(data),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "list_reports": {
        const data = loadReports();
        let reports = data.reports;

        if (args?.type) {
          reports = reports.filter(r => r.type === args.type);
        }
        if (args?.status) {
          reports = reports.filter(r => r.status === args.status);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(reports, null, 2),
            },
          ],
        };
      }

      case "add_report": {
        const data = loadReports();
        const now = new Date().toISOString();

        const newReport: Report = {
          id: generateId(),
          name: args!.name as string,
          type: args!.type as "sovereign" | "quasi-sovereign",
          status: "pending",
          description: args?.description as string | undefined,
          attachments: [],
          createdAt: now,
          updatedAt: now,
        };

        data.reports.push(newReport);
        saveReports(data);

        return {
          content: [
            {
              type: "text",
              text: `Created report: ${newReport.name} (${newReport.id})`,
            },
          ],
        };
      }

      case "update_report": {
        const data = loadReports();
        const report = data.reports.find(r => r.id === args!.id);

        if (!report) {
          return {
            content: [{ type: "text", text: `Report not found: ${args!.id}` }],
            isError: true,
          };
        }

        if (args?.name) report.name = args.name as string;
        if (args?.status) report.status = args.status as Report["status"];
        if (args?.description) report.description = args.description as string;
        report.updatedAt = new Date().toISOString();

        saveReports(data);

        return {
          content: [
            {
              type: "text",
              text: `Updated report: ${report.name}`,
            },
          ],
        };
      }

      case "delete_report": {
        const data = loadReports();
        const index = data.reports.findIndex(r => r.id === args!.id);

        if (index === -1) {
          return {
            content: [{ type: "text", text: `Report not found: ${args!.id}` }],
            isError: true,
          };
        }

        const [deleted] = data.reports.splice(index, 1);
        saveReports(data);

        return {
          content: [
            {
              type: "text",
              text: `Deleted report: ${deleted.name}`,
            },
          ],
        };
      }

      case "upload_file": {
        const data = loadReports();
        const report = data.reports.find(r => r.id === args!.reportId);

        if (!report) {
          return {
            content: [{ type: "text", text: `Report not found: ${args!.reportId}` }],
            isError: true,
          };
        }

        ensureDataDir();

        // Decode base64 and save file
        const filename = args!.filename as string;
        const safeFilename = `${report.id}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        const buffer = Buffer.from(args!.contentBase64 as string, "base64");
        fs.writeFileSync(filePath, buffer);

        // Add to report attachments
        if (!report.attachments) report.attachments = [];
        report.attachments.push(safeFilename);
        report.updatedAt = new Date().toISOString();

        saveReports(data);

        return {
          content: [
            {
              type: "text",
              text: `Uploaded file: ${filename} (${buffer.length} bytes) to report ${report.name}`,
            },
          ],
        };
      }

      case "list_attachments": {
        const data = loadReports();
        const report = data.reports.find(r => r.id === args!.reportId);

        if (!report) {
          return {
            content: [{ type: "text", text: `Report not found: ${args!.reportId}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report.attachments || [], null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

// Run as stdio server (for local use)
async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sov-Quasi Reports MCP server running on stdio");
}

// Run as HTTP/SSE server (for Railway deployment)
async function runHttp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Store active transports
  const transports = new Map<string, SSEServerTransport>();

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "sov-quasi-reports-mcp" });
  });

  // SSE endpoint for MCP connections
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("New SSE connection");

    const server = createServer();
    const transport = new SSEServerTransport("/messages", res);

    // Store transport with a unique ID
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    transports.set(connectionId, transport);

    // Clean up on close
    res.on("close", () => {
      console.log(`SSE connection closed: ${connectionId}`);
      transports.delete(connectionId);
    });

    await server.connect(transport);
  });

  // Messages endpoint for client->server communication
  app.post("/messages", async (req: Request, res: Response) => {
    // Find the transport that matches (in a real app, you'd use session IDs)
    const transport = Array.from(transports.values())[0];
    if (!transport) {
      res.status(404).json({ error: "No active connection" });
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Simple REST API for direct access (non-MCP clients)
  app.get("/api/reports", (_req: Request, res: Response) => {
    const data = loadReports();
    res.json(data);
  });

  app.post("/api/reports", (req: Request, res: Response) => {
    const data = loadReports();
    const now = new Date().toISOString();

    const newReport: Report = {
      id: generateId(),
      name: req.body.name,
      type: req.body.type,
      status: "pending",
      description: req.body.description,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };

    data.reports.push(newReport);
    saveReports(data);
    res.status(201).json(newReport);
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Sov-Quasi Reports MCP server running on http://localhost:${PORT}`);
    console.log(`  - Health: http://localhost:${PORT}/health`);
    console.log(`  - SSE (MCP): http://localhost:${PORT}/sse`);
    console.log(`  - REST API: http://localhost:${PORT}/api/reports`);
  });
}

// Main - check if running in HTTP mode
async function main() {
  const useHttp = process.env.MCP_HTTP === "true" || process.env.PORT;

  if (useHttp) {
    await runHttp();
  } else {
    await runStdio();
  }
}

main().catch(console.error);
