# Sovereign & Quasi-Sovereign Reports MCP Server

An MCP (Model Context Protocol) server for managing a list of reports for sovereigns and quasi-sovereigns, with file upload support for mobile documents.

## Features

- **List management**: Add, update, delete, and list reports
- **Two report types**: Sovereign and Quasi-Sovereign
- **Status tracking**: Pending, In-Progress, Completed
- **File uploads**: Upload documents as base64 (mobile-friendly)
- **Dual storage**: Data stored as both JSON and Markdown for easy viewing
- **Extensible**: Designed for future Supabase integration

## Installation

```bash
npm install
npm run build
```

## Usage

### Deploy to Railway (Recommended)

1. Push this repo to GitHub
2. Go to [Railway](https://railway.app) and create a new project
3. Select "Deploy from GitHub repo"
4. Railway will auto-detect the config and deploy

Once deployed, you'll get endpoints:
- **Health**: `https://your-app.railway.app/health`
- **MCP SSE**: `https://your-app.railway.app/sse`
- **REST API**: `https://your-app.railway.app/api/reports`

### With Claude Desktop (Local)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "sov-quasi-reports": {
      "command": "node",
      "args": ["/path/to/sov-quasi-list/dist/index.js"]
    }
  }
}
```

### With Claude Desktop (Remote via Railway)

```json
{
  "mcpServers": {
    "sov-quasi-reports": {
      "url": "https://your-app.railway.app/sse"
    }
  }
}
```

### Development

```bash
# Local stdio mode
npm run dev

# Local HTTP mode (simulates Railway)
PORT=3000 npm run dev
```

## Tools

| Tool | Description |
|------|-------------|
| `list_reports` | List all reports, optionally filter by type or status |
| `add_report` | Add a new report (name, type, description) |
| `update_report` | Update report name, status, or description |
| `delete_report` | Delete a report by ID |
| `upload_file` | Upload a file (base64) and attach to a report |
| `list_attachments` | List all attachments for a report |

## Resources

| URI | Description |
|-----|-------------|
| `reports://list` | Current reports as JSON |
| `reports://markdown` | Reports formatted as Markdown |

## Data Storage

Data is stored in the `data/` directory:
- `reports.json` - Main data file (JSON)
- `reports.md` - Human-readable markdown view (auto-generated)
- `uploads.json` - Upload tracking with sync status
- `uploads/` - Uploaded file attachments

## Mobile → Cloud → Mac Sync Workflow

This server supports syncing raw reports from mobile devices to your Mac for processing:

```
┌─────────┐     POST /api/upload      ┌─────────────┐     sync script     ┌─────────┐
│ Mobile  │ ──────────────────────────▶ │   Railway   │ ◀──────────────────│   Mac   │
│ (Orca)  │   raw markdown files       │  MCP Server │   fetch & process  │         │
└─────────┘                            └─────────────┘                     └─────────┘
```

### Sync Status Flow

Files progress through these statuses:
1. `pending-sync` - Uploaded to cloud, awaiting Mac sync
2. `synced` - Downloaded to Mac
3. `processing` - Currently being processed
4. `processed` - Processing complete

### Sync Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/pending` | GET | List files waiting to be synced |
| `/api/sync/download/:filename` | GET | Download a specific file |
| `/api/sync/mark-synced` | POST | Mark files as synced |
| `/api/sync/update-status` | POST | Update file status |
| `/api/sync/status` | GET | Get sync status summary |

### Mac Sync Script

Run the sync script on your Mac to pull new uploads:

```bash
# Using Python (recommended)
python scripts/sync_from_cloud.py --server https://your-app.railway.app

# Using Bash
./scripts/sync-from-cloud.sh https://your-app.railway.app

# Dry run (see what would be downloaded)
python scripts/sync_from_cloud.py --server https://your-app.railway.app --dry-run
```

Environment variables:
- `SOV_SYNC_SERVER` - Server URL (default: http://localhost:3000)
- `RAW_REPORTS_DIR` - Output directory for downloaded files

## Example Usage

```
# Add a sovereign report
add_report(name: "Brazil 2024", type: "sovereign", description: "Annual sovereign report")

# Add a quasi-sovereign report
add_report(name: "Petrobras Q4", type: "quasi-sovereign", description: "Quarterly report")

# List all pending reports
list_reports(status: "pending")

# Upload a document from mobile
upload_file(reportId: "report_123...", filename: "doc.pdf", contentBase64: "...")
```

## Future Enhancements

- [ ] Supabase integration for cloud storage
- [ ] Real-time sync across devices
- [ ] Report templates
- [ ] Due date tracking
