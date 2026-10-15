# Forerunner Headless - Quick Start Guide

Get up and running with Forerunner Headless in 5 minutes.

## 1. Installation

```bash
cd forerunner-headless
npm install
```

## 2. Verify Setup

```bash
./verify-setup.sh
```

This will check:
- Node.js version (18+ required)
- Dependencies installed
- Salesforce CLI available
- Agentia CLI available
- Environment variables set

## 3. Set Credentials

### Option A: Environment Variables (Recommended)

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export SF_USERNAME=your.email@company.com
export AGENTIA_WORKSPACE=your-workspace-id
export COPADO_API_KEY=your-copado-api-key
```

Then reload:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

### Option B: .env File

```bash
cp .env.example .env
# Edit .env with your credentials
```

## 4. Test Connection

```bash
./forerunner-headless help
```

You should see the help menu. If you see credential warnings, that's expected if you haven't set them yet (demo mode will be used).

## 5. Run Your First Scan

```bash
./forerunner-headless scan
```

This will:
- Connect to your Salesforce org (or use demo data)
- Scan for release updates
- Display a summary table
- Cache results for later analysis

## 6. Interactive Mode

```bash
./forerunner-headless interactive
```

This guided workflow will:
1. Scan for release updates
2. Let you select one
3. Run AI-powered impact analysis
4. Create a Copado story (optional)
5. Link affected metadata
6. Validate quality gates

## 7. MCP Server (Optional)

To use with Claude Desktop or other AI assistants:

```bash
npm run mcp
```

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forerunner-headless": {
      "command": "node",
      "args": ["/path/to/forerunner-headless/mcp-server.js"],
      "env": {
        "SALESFORCE_USERNAME": "your.email@company.com",
        "AGENTIA_WORKSPACE": "your-workspace-id",
        "COPADO_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Common Commands

```bash
# Scan for updates
./forerunner-headless scan

# Analyze specific update
./forerunner-headless analyze "API Version 60.0"

# Run AI debate
./forerunner-headless debate "Lightning Security Update"

# Create Copado story
./forerunner-headless story "API Version 60.0"

# View status report
./forerunner-headless status
```

## Getting Credentials

### Salesforce

```bash
sf org login web --alias production
sf org display --target-org production
# Copy the username shown
```

### Agentia

```bash
npm install -g @salesforce/agentia-cli
agentia auth set --workspace YOUR_WORKSPACE_ID
agentia workspace list
```

### Copado

1. Log in to Copado
2. Go to Setup > API Keys
3. Create a new API key
4. Copy the key value

## Troubleshooting

### "Command not found: ./forerunner-headless"

Make it executable:
```bash
chmod +x forerunner-headless
chmod +x forerunner-headless-cli.js
chmod +x mcp-server.js
```

### "Missing credentials" warning

Set environment variables (see step 3 above).

### "Cannot find module"

Install dependencies:
```bash
npm install
```

### Authentication errors

Verify your credentials:
```bash
sf org display --target-org production
agentia auth get
```

## Next Steps

- Read [README.md](./README.md) for detailed documentation
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Explore the `src/` directory to customize behavior

## Demo Mode

Don't have credentials yet? Try demo mode:

```bash
# Demo mode is automatically enabled when credentials are missing
./forerunner-headless scan
```

You'll see simulated data to explore the interface.

## Support

- Issues: https://github.com/yourorg/forerunner-headless/issues
- Documentation: https://github.com/yourorg/forerunner-headless/wiki
