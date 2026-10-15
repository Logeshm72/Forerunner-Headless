#!/usr/bin/env node

/**
 * Forerunner MCP CLI
 *
 * A standalone CLI that connects to Forerunner MCP server
 * Zero dependencies - just Node.js standard library
 *
 * Usage:
 *   forerunner-mcp info                           - List available tools
 *   forerunner-mcp scan                           - Scan for release updates
 *   forerunner-mcp analyze <update-name>          - Analyze specific update
 *   forerunner-mcp debate <update-name>           - Run AI debate
 *   forerunner-mcp story <update-name>            - Create Copado story
 */

const { spawn } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { homedir } = require('os');
const { join } = require('path');

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Config paths
const MCP_SERVER_PATH = join(__dirname, 'mcp-server.js');
const CONFIG_PATH = join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');

class ForerunnerMCPClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
  }

  // Start MCP server as subprocess
  async startServer() {
    if (!existsSync(MCP_SERVER_PATH)) {
      throw new Error(`MCP server not found at ${MCP_SERVER_PATH}`);
    }

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [MCP_SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'inherit']
      });

      // Wait for server ready
      const timeout = setTimeout(() => {
        reject(new Error('MCP server startup timeout'));
      }, 5000);

      this.serverProcess.stdout.once('data', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.serverProcess.on('error', reject);
    });
  }

  // Send JSON-RPC request to MCP server
  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      let responseData = '';

      const dataHandler = (data) => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData);
          this.serverProcess.stdout.off('data', dataHandler);
          resolve(response);
        } catch (e) {
          // Continue accumulating data
        }
      };

      this.serverProcess.stdout.on('data', dataHandler);
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

      setTimeout(() => {
        this.serverProcess.stdout.off('data', dataHandler);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  // Stop server
  async stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  // Pretty print tools
  printTools(tools) {
    console.log(`\n${colors.bold}${colors.cyan}Available Forerunner Tools:${colors.reset}\n`);

    tools.forEach(tool => {
      console.log(`${colors.bold}${colors.green}${tool.name}${colors.reset}`);
      console.log(`  ${colors.dim}${tool.description}${colors.reset}`);

      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log(`  ${colors.yellow}Parameters:${colors.reset}`);
        Object.entries(tool.inputSchema.properties).forEach(([key, value]) => {
          const required = tool.inputSchema.required?.includes(key) ? '(required)' : '(optional)';
          console.log(`    ${colors.cyan}${key}${colors.reset} ${colors.dim}${required}${colors.reset} - ${value.description || value.type}`);
        });
      }
      console.log('');
    });
  }

  // Pretty print result
  printResult(result) {
    if (typeof result === 'string') {
      console.log(result);
    } else if (Array.isArray(result.content)) {
      result.content.forEach(item => {
        if (item.type === 'text') {
          console.log(item.text);
        }
      });
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

// CLI Commands
async function infoCommand() {
  const client = new ForerunnerMCPClient();

  try {
    console.log(`${colors.dim}Starting Forerunner MCP server...${colors.reset}`);
    await client.startServer();

    const response = await client.sendRequest('tools/list');

    if (response.result && response.result.tools) {
      client.printTools(response.result.tools);
    } else {
      console.error(`${colors.red}No tools found${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  } finally {
    await client.stop();
  }
}

async function callTool(toolName, args = {}) {
  const client = new ForerunnerMCPClient();

  try {
    console.log(`${colors.dim}Starting Forerunner MCP server...${colors.reset}`);
    await client.startServer();

    console.log(`${colors.cyan}Calling tool: ${toolName}${colors.reset}`);
    const response = await client.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    if (response.result) {
      console.log(`\n${colors.bold}${colors.green}✓ Result:${colors.reset}\n`);
      client.printResult(response.result);
    } else if (response.error) {
      console.error(`${colors.red}Error: ${response.error.message}${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  } finally {
    await client.stop();
  }
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(`${colors.bold}${colors.blue}Forerunner MCP CLI${colors.reset}\n`);

  switch (command) {
    case 'info':
      await infoCommand();
      break;

    case 'scan':
      await callTool('scan_release_updates', {
        forceRefresh: args.includes('--refresh')
      });
      break;

    case 'analyze':
      if (!args[1]) {
        console.error(`${colors.red}Error: Update name required${colors.reset}`);
        console.log(`Usage: forerunner-mcp analyze <update-name>`);
        process.exit(1);
      }
      await callTool('analyze_release_impact', {
        updateName: args.slice(1).join(' ')
      });
      break;

    case 'debate':
      if (!args[1]) {
        console.error(`${colors.red}Error: Update name required${colors.reset}`);
        console.log(`Usage: forerunner-mcp debate <update-name>`);
        process.exit(1);
      }
      await callTool('run_ai_debate', {
        updateName: args.slice(1).join(' ')
      });
      break;

    case 'story':
      if (!args[1]) {
        console.error(`${colors.red}Error: Update name required${colors.reset}`);
        console.log(`Usage: forerunner-mcp story <update-name>`);
        process.exit(1);
      }
      await callTool('create_copado_story', {
        updateName: args.slice(1).join(' ')
      });
      break;

    case 'help':
    default:
      console.log(`${colors.bold}Usage:${colors.reset}
  ${colors.cyan}forerunner-mcp info${colors.reset}                          - List available tools
  ${colors.cyan}forerunner-mcp scan${colors.reset} [--refresh]               - Scan for release updates
  ${colors.cyan}forerunner-mcp analyze${colors.reset} <update-name>          - Analyze specific update
  ${colors.cyan}forerunner-mcp debate${colors.reset} <update-name>           - Run AI debate on update
  ${colors.cyan}forerunner-mcp story${colors.reset} <update-name>            - Create Copado story

${colors.bold}Examples:${colors.reset}
  forerunner-mcp info
  forerunner-mcp scan --refresh
  forerunner-mcp analyze "API Version 60.0 Enforcement"
  forerunner-mcp debate "API Version 60.0 Enforcement"
  forerunner-mcp story "API Version 60.0 Enforcement"

${colors.dim}MCP Server: ${MCP_SERVER_PATH}${colors.reset}
`);
      break;
  }
}

// Run
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
