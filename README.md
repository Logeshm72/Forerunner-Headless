# Forerunner-Headless# Forerunner Headless

**AI-Powered Salesforce Release Impact Analysis**

Forerunner Headless is a command-line tool and MCP (Model Context Protocol) server that helps Salesforce teams proactively manage release updates using AI-powered analysis.

## Features

- 🔍 **Automated Release Scanning** - Detect upcoming Salesforce release updates
- 🤖 **AI Impact Analysis** - Use Agentia AI to assess impact on your org
- 📊 **Multi-Agent Debate** - Get balanced perspectives from Sentinel and Orchestrator agents
- 🎯 **Smart Prioritization** - Identify critical updates that need immediate attention
- 🔗 **Copado Integration** - Automatically create stories and link affected metadata
- 💬 **MCP Server** - Works with Claude Desktop and other AI assistants
- 🎨 **Interactive CLI** - Beautiful terminal UI with guided workflows

## Quick Start

```bash
# Clone and install
git clone https://github.com/Logeshm72/Forerunner-Headless.git
cd Forerunner-Headless
npm install

# Set credentials
export SF_USERNAME=your.email@company.com
export AGENTIA_WORKSPACE=your-workspace-id
export COPADO_API_KEY=your-api-key

# Run your first scan
./forerunner-headless scan
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

## Prerequisites

- **Node.js** 18+ (required)
- **Salesforce CLI** (recommended) - `npm install -g @salesforce/cli`
- **Agentia CLI** (optional) - `npm install -g @salesforce/agentia-cli`

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Logeshm72/Forerunner-Headless.git
cd Forerunner-Headless
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Credentials

#### Option A: Environment Variables (Recommended)

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export SF_USERNAME=your.email@company.com
export AGENTIA_WORKSPACE=your-workspace-id
export COPADO_API_KEY=your-api-key
```

Then reload:
```bash
source ~/.zshrc
```

#### Option B: .env File

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 4. Verify Setup

```bash
./verify-setup.sh
```

## Usage

### Command Line Interface

```bash
# Scan for release updates
./forerunner-headless scan

# Interactive guided workflow
./forerunner-headless interactive

# Analyze specific update
./forerunner-headless analyze "Lightning Message Service Security Update"

# Run AI debate on an update
./forerunner-headless debate "API Version 60.0"

# Create Copado story
./forerunner-headless story "Apex Trigger Execution Order Changes"

# View status report
./forerunner-headless status

# Get help
./forerunner-headless help
```

### MCP Server

Use with Claude Desktop or other AI assistants:

```bash
npm run mcp
```

Add to your `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forerunner-headless": {
      "command": "node",
      "args": ["/absolute/path/to/forerunner-headless/mcp-server.js"],
      "env": {
        "SALESFORCE_USERNAME": "your.email@company.com",
        "AGENTIA_WORKSPACE": "your-workspace-id",
        "COPADO_API_KEY": "your-api-key"
      }
    }
  }
}
```

Then use in Claude Desktop:
- "Scan for Salesforce release updates"
- "Analyze the impact of Lightning Message Service changes"
- "Create a Copado story for API version update"

## How It Works

### 1. Release Scanning
- Connects to Salesforce Tooling API
- Queries `ReleaseUpdate` object for upcoming changes
- Caches results for offline analysis

### 2. AI Impact Analysis
- Uses Agentia AI to analyze update descriptions
- Queries org metadata (Apex, LWC, Flows, Triggers)
- Identifies potentially affected components
- Generates impact scores and recommendations

### 3. Multi-Agent Debate
- **Sentinel Agent**: Risk-focused, conservative perspective
- **Orchestrator Agent**: Balanced, practical implementation view
- Provides comprehensive analysis from different angles

### 4. Copado Integration
- Creates stories with impact analysis
- Links affected metadata as work items
- Sets priority based on criticality

## Architecture

```
forerunner-headless/
├── src/
│   ├── agents/          # AI agents (Sentinel, Orchestrator)
│   ├── commands/        # CLI command implementations
│   ├── integrations/    # Salesforce, Agentia, Copado, Slack
│   └── utils/          # Cache, logger, helpers
├── forerunner-headless  # Bash wrapper (credential management)
├── forerunner-headless-cli.js  # Node.js CLI entry point
└── mcp-server.js       # MCP server for AI assistants
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SF_USERNAME` | Yes* | Salesforce username |
| `SALESFORCE_USERNAME` | Yes* | Alternative to SF_USERNAME |
| `AGENTIA_WORKSPACE` | Yes | Agentia AI workspace ID |
| `COPADO_API_KEY` | Optional | Copado API key for story creation |
| `SLACK_TOKEN` | Optional | Slack bot token for notifications |
| `SF_TARGET_ORG` | Optional | Specific org to target (uses default if not set) |

*Either `SF_USERNAME` or `SALESFORCE_USERNAME` is required. Demo mode is available if not set.

### Getting Credentials

#### Salesforce CLI Authentication

```bash
sf org login web --alias production
sf org display --target-org production
```

#### Agentia Workspace

```bash
npm install -g @salesforce/agentia-cli
agentia auth set --workspace YOUR_WORKSPACE_ID
agentia workspace list
```

#### Copado API Key

1. Log in to Copado
2. Go to Setup > API Keys
3. Create a new API key
4. Set as `COPADO_API_KEY` environment variable

## Demo Mode

Don't have credentials? Try demo mode with simulated data:

```bash
# Just run without setting credentials
./forerunner-headless scan
```

## Security Best Practices

- **Never commit credentials** to version control
- Use environment variables instead of `.env` files in production
- Rotate API keys regularly
- Use separate credentials for each environment

```bash
# Set credentials in CI environment
export SF_USERNAME=$CI_SF_USERNAME
export AGENTIA_WORKSPACE=$CI_AGENTIA_WORKSPACE
export COPADO_API_KEY=$CI_COPADO_KEY
```

## Troubleshooting

### Authentication Errors

```bash
# Verify Salesforce CLI authentication
sf org display --target-org production

# Re-authenticate if needed
sf org login web --alias production
```

### Missing Dependencies

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### MCP Server Not Connecting

- Verify absolute paths in `claude_desktop_config.json`
- Check that Node.js is in your PATH
- Restart Claude Desktop after config changes

## Development

### Project Structure

- **CLI Commands**: `src/commands/*.js` - Each command is a separate module
- **Agents**: `src/agents/*.js` - AI agent implementations
- **Integrations**: `src/integrations/*.js` - External service connectors

### Adding a New Command

1. Create `src/commands/your-command.js`
2. Export an async function that takes `args` and `options`
3. Add command to `forerunner-headless-cli.js`
4. Add MCP tool definition in `mcp-server.js` (optional)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) for details

## Hackathon

Built for **Copado Hackathon 2026**  
Category: Best Use of Copado AI Assistant

## Support

- **Issues**: [GitHub Issues](https://github.com/Logeshm72/Forerunner-Headless/issues)
- **Documentation**: See [QUICKSTART.md](./QUICKSTART.md) and [ARCHITECTURE.md](./ARCHITECTURE.md)

## Acknowledgments

- Salesforce for Agentia AI and Salesforce CLI
- Copado for ALM platform and APIs
- Model Context Protocol for AI assistant integration
