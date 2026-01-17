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

### With Claude Desktop

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

### Development

```bash
npm run dev
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
- `uploads/` - Uploaded file attachments

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
