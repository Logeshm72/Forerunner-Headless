#!/usr/bin/env node

/**
 * Forerunner MCP Server
 * Exposes Forerunner capabilities to AI assistants via Model Context Protocol
 *
 * Compatible with:
 * - Claude Desktop
 * - Cursor IDE
 * - VS Code + Cline
 * - Any MCP-compatible client 
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

// Create MCP server
const server = new Server(
  {
    name: 'forerunner',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Base path to Forerunner CLI
const FORERUNNER_PATH = __dirname;

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'scan_release_updates',
        description: 'Scan Salesforce org for upcoming release updates that may impact your org. Returns list of updates with priority, due dates, and enforcement status.',
        inputSchema: {
          type: 'object',
          properties: {
            notify_slack: {
              type: 'boolean',
              description: 'Send scan results to Slack channel (requires SLACK_WEBHOOK_URL configured)',
              default: false
            }
          }
        }
      },
      {
        name: 'analyze_release_update',
        description: 'Analyze the impact of a specific release update using AI-powered adversarial debate (Build Agent vs Sentinel Agent). Queries org metadata, runs multi-round AI debate, and produces risk assessment.',
        inputSchema: {
          type: 'object',
          properties: {
            update_id: {
              type: 'string',
              description: 'The release update ID or partial ID to analyze (e.g., "a0b7e00000A" or "RU-2027-001")'
            },
            with_debate: {
              type: 'boolean',
              description: 'Run full AI debate between Build Agent and Sentinel Agent (recommended)',
              default: true
            },
            verbose: {
              type: 'boolean',
              description: 'Show detailed debate transcript and analysis steps',
              default: false
            }
          },
          required: ['update_id']
        }
      },
      {
        name: 'create_copado_story',
        description: 'Automatically create a Copado user story via Agentia CICD for addressing a release update issue. Includes AI-generated acceptance criteria, risk assessment, and affected components list.',
        inputSchema: {
          type: 'object',
          properties: {
            update_id: {
              type: 'string',
              description: 'The release update ID to create a story for'
            },
            force: {
              type: 'boolean',
              description: 'Create story even if no cached analysis exists',
              default: false
            }
          },
          required: ['update_id']
        }
      },
      {
        name: 'check_authentication',
        description: 'Check authentication status for Salesforce org and Agentia (CICD + AI). Returns connection status, available features, and configuration issues.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_release_update_details',
        description: 'Get detailed information about a specific release update including description, due date, enforcement status, and Salesforce documentation links.',
        inputSchema: {
          type: 'object',
          properties: {
            update_id: {
              type: 'string',
              description: 'The release update ID'
            }
          },
          required: ['update_id']
        }
      },
      {
        name: 'get_action_plan',
        description: 'Generate a complete action plan for a release update. This combines analysis and recommendations into a ready-to-implement plan with affected components, risk assessment, and next steps.',
        inputSchema: {
          type: 'object',
          properties: {
            update_id: {
              type: 'string',
              description: 'The release update ID to generate action plan for'
            },
            with_debate: {
              type: 'boolean',
              description: 'Include AI debate in analysis (recommended for better accuracy)',
              default: true
            }
          },
          required: ['update_id']
        }
      }
    ]
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'scan_release_updates':
        return await scanReleaseUpdates(args);

      case 'analyze_release_update':
        return await analyzeReleaseUpdate(args);

      case 'create_copado_story':
        return await createCopadoStory(args);

      case 'check_authentication':
        return await checkAuthentication();

      case 'get_release_update_details':
        return await getReleaseUpdateDetails(args);

      case 'get_action_plan':
        return await getActionPlan(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message}\n\nStack trace:\n${error.stack}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Scan for Salesforce release updates
 */
async function scanReleaseUpdates(args) {
  const notifyFlag = args.notify_slack ? '--notify-slack' : '';

  const { stdout, stderr } = await execPromise(
    `cd ${FORERUNNER_PATH} && node src/index.js scan ${notifyFlag}`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
  );

  // Parse output to extract structured data
  const output = stdout + stderr;
  const totalMatch = output.match(/Found (\d+) release updates/);
  const criticalMatch = output.match(/Critical[^\d]*(\d+)/);
  const autoEnabledMatch = output.match(/Auto-enabled[^\d]*(\d+)/);

  return {
    content: [
      {
        type: 'text',
        text: `**Salesforce Release Update Scan Complete**\n\n${output}\n\n**Summary:**\n- Total updates: ${totalMatch ? totalMatch[1] : 'unknown'}\n- Critical: ${criticalMatch ? criticalMatch[1] : '0'}\n- Auto-enabled: ${autoEnabledMatch ? autoEnabledMatch[1] : '0'}\n\nNext steps:\n- Use \`analyze_release_update\` to analyze specific updates\n- High-risk updates should be analyzed with AI debate`
      }
    ]
  };
}

/**
 * Analyze specific release update with AI debate
 */
async function analyzeReleaseUpdate(args) {
  const debateFlag = args.with_debate ? '--with-debate' : '';
  const verboseFlag = args.verbose ? '--verbose' : '';

  const { stdout, stderr } = await execPromise(
    `cd ${FORERUNNER_PATH} && node src/index.js analyze --update ${args.update_id} ${debateFlag} ${verboseFlag}`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 300000 } // 5 min timeout for AI debate
  );

  const output = stdout + stderr;

  // Extract key information
  const riskMatch = output.match(/Risk Level[:\s]+(\w+)/i);
  const consensusMatch = output.match(/Consensus Reached[:\s]+(YES|NO)/i);
  const roundsMatch = output.match(/(\d+) rounds/);

  return {
    content: [
      {
        type: 'text',
        text: `**AI Debate Analysis Complete**\n\n${output}\n\n**Key Findings:**\n- Risk Level: ${riskMatch ? riskMatch[1] : 'unknown'}\n- Consensus: ${consensusMatch ? consensusMatch[1] : 'unknown'}\n- Debate Rounds: ${roundsMatch ? roundsMatch[1] : 'unknown'}\n\n**Next Steps:**\n- If HIGH risk: Use \`create_copado_story\` to create fix story\n- If MEDIUM risk: Schedule testing in sandbox\n- If LOW risk: Monitor during deployment window`
      }
    ]
  };
}

/**
 * Create Copado story via Agentia CICD
 */
async function createCopadoStory(args) {
  const forceFlag = args.force ? '--force' : '';

  const { stdout, stderr } = await execPromise(
    `cd ${FORERUNNER_PATH} && node src/index.js story --update ${args.update_id} ${forceFlag}`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
  );

  const output = stdout + stderr;

  // Extract story ID
  const storyMatch = output.match(/Story (US-\d+|a\w+) created/i);

  return {
    content: [
      {
        type: 'text',
        text: `**Copado Story Created**\n\n${output}\n\n${storyMatch ? `✓ Story ID: ${storyMatch[1]}\n` : ''}\nThe story has been created in Copado with:\n- AI-generated acceptance criteria\n- Risk assessment details\n- Affected components list\n- Recommended actions\n\nView in Copado or check Copado Plan Slack app for updates.`
      }
    ]
  };
}

/**
 * Check authentication status
 */
async function checkAuthentication() {
  try {
    // Check Salesforce
    const sfCheck = await execPromise('sf org list --json 2>&1').catch(() => ({ stdout: '{}' }));

    // Check Agentia
    const agentiaCheck = await execPromise('agentia auth get 2>&1').catch(e => ({ stdout: e.message }));

    const sfData = JSON.parse(sfCheck.stdout || '{}');
    const agentiaOutput = agentiaCheck.stdout;

    const hasSF = sfData.result?.nonScratchOrgs?.length > 0;
    const hasCICD = agentiaOutput.includes('Copado API key (CICD)');
    const hasAI = agentiaOutput.includes('PAK (AI):') && !agentiaOutput.includes('not set');

    return {
      content: [
        {
          type: 'text',
          text: `**Authentication Status**\n\n**Salesforce:**\n${hasSF ? '✅ Connected' : '❌ Not connected'}\n${hasSF ? `- Org: ${sfData.result.nonScratchOrgs[0]?.username || 'N/A'}` : '- Run: sf org login web'}\n\n**Agentia CICD:**\n${hasCICD ? '✅ Authenticated' : '❌ Not authenticated'}\n${hasCICD ? '- Story creation available' : '- Set: agentia auth set --cicd YOUR_API_KEY'}\n\n**Agentia AI:**\n${hasAI ? '✅ Configured' : '❌ Not configured'}\n${hasAI ? '- AI debate available' : '- Optional: Configure for AI-powered analysis'}\n\n**Available Features:**\n- Scan: ${hasSF ? '✅' : '❌'}\n- Analyze: ${hasSF ? '✅' : '❌'} (${hasAI ? 'with AI' : 'basic'})\n- Create Stories: ${hasCICD ? '✅' : '❌'}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error checking authentication: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Get details about a specific release update
 */
async function getReleaseUpdateDetails(args) {
  const { exec } = require('child_process');
  const { loadCache } = require('./src/utils/cache');

  try {
    const cached = loadCache('release-updates');

    if (!cached || !cached.updates) {
      return {
        content: [
          {
            type: 'text',
            text: 'No cached release updates found. Run `scan_release_updates` first.'
          }
        ]
      };
    }

    const update = cached.updates.find(u =>
      u.Id?.includes(args.update_id) ||
      u.DurableId?.includes(args.update_id) ||
      u.Title?.toLowerCase().includes(args.update_id.toLowerCase())
    );

    if (!update) {
      return {
        content: [
          {
            type: 'text',
            text: `Release update "${args.update_id}" not found in cache. Available updates:\n${cached.updates.slice(0, 10).map(u => `- ${u.Id || u.DurableId}: ${u.Title}`).join('\n')}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `**Release Update Details**\n\n**Title:** ${update.Title}\n\n**ID:** ${update.Id || update.DurableId}\n\n**Status:** ${update.Status}\n\n**Release:** ${update.ReleaseLabel || update.Release || 'N/A'}\n\n**Due Date:** ${update.DueDate || 'Not specified'}\n\n**Description:**\n${update.Description || 'No description available'}\n\n**Category:** ${update.Category || 'N/A'}\n\n**Auto-Enabled:** ${update.IsAutoEnabled ? 'Yes' : 'No'}\n\n**Next Steps:**\n- Use \`analyze_release_update\` with ID: ${update.Id || update.DurableId}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error retrieving update details: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Get comprehensive action plan for a release update
 */
async function getActionPlan(args) {
  const debateFlag = args.with_debate !== false ? '--with-debate' : '';

  try {
    // First, run analysis
    const { stdout: analysisOut, stderr: analysisErr } = await execPromise(
      `cd ${FORERUNNER_PATH} && node src/index.js analyze --update ${args.update_id} ${debateFlag}`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 300000 }
    );

    const analysisOutput = analysisOut + analysisErr;

    // Get update details
    const { loadCache } = require('./src/utils/cache');
    const cached = loadCache('release-updates');

    let updateDetails = null;
    if (cached && cached.updates) {
      updateDetails = cached.updates.find(u =>
        u.Id?.includes(args.update_id) ||
        u.DurableId?.includes(args.update_id) ||
        u.Title?.toLowerCase().includes(args.update_id.toLowerCase())
      );
    }

    // Parse analysis results
    const riskMatch = analysisOutput.match(/Risk Level[:\s]+(\w+)/i);
    const consensusMatch = analysisOutput.match(/Consensus[:\s]+(YES|NO)/i);
    const roundsMatch = analysisOutput.match(/(\d+) rounds/i);

    // Extract recommendations
    const recommendations = [];
    const recSection = analysisOutput.match(/Recommendations?:(.*?)(?:\n\n|\n[A-Z]|$)/is);
    if (recSection) {
      const lines = recSection[1].split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && (l.startsWith('-') || l.startsWith('•') || l.match(/^\d+\./)));
      recommendations.push(...lines);
    }

    // Build comprehensive action plan
    const riskLevel = riskMatch ? riskMatch[1].toUpperCase() : 'UNKNOWN';
    const consensus = consensusMatch ? consensusMatch[1] : 'UNKNOWN';
    const actionNeeded = consensus === 'YES';

    let riskEmoji = '🟢';
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') riskEmoji = '🔴';
    else if (riskLevel === 'MEDIUM' || riskLevel === 'MODERATE') riskEmoji = '🟡';

    const plan = `**ACTION PLAN**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Release Update:** ${updateDetails?.Title || args.update_id}
**Status:** ${updateDetails?.Status || 'Unknown'}
**Release:** ${updateDetails?.ReleaseLabel || updateDetails?.Release || 'TBD'}
${updateDetails?.DueDate ? `**Due Date:** ${updateDetails.DueDate}` : ''}

**RISK ASSESSMENT**
${riskEmoji} **Risk Level:** ${riskLevel}
${actionNeeded ? '✅' : '❌'} **Action Required:** ${actionNeeded ? 'YES' : 'NO'}
${roundsMatch ? `**AI Analysis:** ${roundsMatch[1]} debate rounds completed` : ''}

**RECOMMENDED ACTIONS**
${recommendations.length > 0 ? recommendations.map(r => r.startsWith('-') || r.startsWith('•') ? r : `- ${r}`).join('\n') : '- Review update documentation\n- Test in sandbox environment\n- Assess impact on current implementations'}

**NEXT STEPS**
${actionNeeded ? '1. Create a Copado user story to track this work\n2. Schedule sandbox testing\n3. Assign to appropriate team member\n4. Set target completion date before enforcement' : '1. Monitor for changes in update status\n2. Review before next release\n3. Document decision not to act'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Create Story?**
${actionNeeded ? 'Use `create_copado_story` with update ID: ' + args.update_id : 'Story creation not recommended for this update (low risk/no action needed)'}`;

    return {
      content: [
        {
          type: 'text',
          text: plan
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error generating action plan: ${error.message}\n\nTry running \`analyze_release_update\` first, or check if the update ID is correct.`
        }
      ],
      isError: true
    };
  }
}

/**
 * Start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Forerunner MCP Server started');
  console.error('Available tools: scan_release_updates, analyze_release_update, create_copado_story, check_authentication, get_release_update_details');
}

main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});
