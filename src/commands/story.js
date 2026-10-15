const chalk = require('chalk');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

/**
 * Create Copado user story via Agentia CICD
 * This uses REAL Agentia integration!
 */
async function storyCommand(options) {
  console.log(chalk.bold('\n📋 Forerunner - Story Creation\n'));

  const updateId = options.update;

  if (!updateId) {
    console.log(chalk.red('❌ Update ID is required'));
    console.log(chalk.dim('   Usage: forerunner story --update UPDATE_ID'));
    return;
  }

  try {
    // Check if Agentia CICD is authenticated
    const authCheck = await checkAgentiaAuth();

    if (!authCheck.cicd) {
      console.log(chalk.red('❌ Agentia CICD not configured'));
      console.log(chalk.dim('   Run: agentia auth set --cicd YOUR_API_KEY'));
      return;
    }

    console.log(chalk.green('✓ Agentia CICD authenticated\n'));

    // Load cached analysis if available
    const cacheDir = path.join(process.cwd(), '.forerunner-cache');
    const analysisFile = path.join(cacheDir, `analysis-${updateId}.json`);

    let analysisData = null;

    try {
      const data = await fs.readFile(analysisFile, 'utf-8');
      analysisData = JSON.parse(data);
      console.log(chalk.dim('Loaded cached analysis\n'));
    } catch (error) {
      if (!options.force) {
        console.log(chalk.yellow('⚠️  No cached analysis found'));
        console.log(chalk.dim('   Run: forerunner analyze --update ' + updateId));
        console.log(chalk.dim('   Or use --force to create story without analysis\n'));
        return;
      }
      console.log(chalk.dim('Creating story without analysis (--force)\n'));
    }

    // Prepare story details
    const story = prepareStory(updateId, analysisData);

    console.log(chalk.bold('Creating Copado Story:\n'));
    console.log(chalk.dim('  Title:'), story.title);
    console.log(chalk.dim('  Priority:'), story.priority, `(${story.riskLevel})`);
    console.log();

    // Create story via Agentia CICD
    const storyResult = await createAgentiaStory(story);

    if (storyResult.success) {
      console.log(chalk.green('✓ Story created successfully!\n'));
      console.log(chalk.bold('Story Details:'));
      console.log(chalk.dim('  ID:'), storyResult.storyId || 'N/A');
      console.log(chalk.dim('  Status:'), storyResult.status || 'New');
      console.log();

      // Save story reference
      await saveStoryReference(updateId, storyResult);

      console.log(chalk.cyan('🔗 View in Copado:'), storyResult.url || 'https://app.copado.com');
      console.log();
    } else {
      console.log(chalk.red('❌ Story creation failed'));
      console.log(chalk.dim('   Error:'), storyResult.error);
      console.log();
    }

  } catch (error) {
    console.error(chalk.red('❌ Story creation failed:'), error.message);
  }
}

/**
 * Check Agentia authentication status
 */
async function checkAgentiaAuth() {
  try {
    const { stdout } = await execPromise('agentia auth get 2>&1');

    // Parse text output (CLI doesn't always return JSON)
    const hasCICD = stdout.includes('Copado API key (CICD)') && stdout.includes('6aa0d');
    const hasAI = stdout.includes('PAK (AI):') && !stdout.includes('not set');

    return {
      cicd: hasCICD,
      ai: hasAI
    };
  } catch (error) {
    return { cicd: false, ai: false };
  }
}

/**
 * Prepare story details from analysis
 */
function prepareStory(updateId, analysisData) {
  if (!analysisData) {
    return {
      title: `Salesforce Release Update: ${updateId}`,
      description: `Release update ${updateId} requires testing and validation before production deployment.`,
      priority: mapRiskToPriority('HIGH'),  // Returns integer
      riskLevel: 'UNKNOWN',
      tags: ['release-update', 'forerunner', 'automated']
    };
  }

  const { updateInfo, debate } = analysisData;

  const title = `Fix Release Update: ${updateInfo.Title || updateId}`;

  const description = buildStoryDescription(updateInfo, debate);

  const priority = mapRiskToPriority(debate?.finalRecommendation?.riskLevel || 'HIGH');

  return {
    title,
    description,
    priority,
    riskLevel: debate?.finalRecommendation?.riskLevel || 'UNKNOWN',
    tags: ['release-update', 'forerunner', 'automated'],
    updateInfo,
    debate
  };
}

/**
 * Build comprehensive story description
 */
function buildStoryDescription(updateInfo, debate) {
  let desc = `## Release Update Details\n\n`;
  desc += `**Title:** ${updateInfo.Title}\n`;
  desc += `**Status:** ${updateInfo.Status}\n`;
  desc += `**Release:** ${updateInfo.ReleaseLabel || 'N/A'}\n`;
  desc += `**Due Date:** ${updateInfo.DueDate || 'TBD'}\n\n`;

  if (updateInfo.Description) {
    desc += `**Description:**\n${updateInfo.Description}\n\n`;
  }

  if (debate) {
    desc += `## AI Debate Analysis\n\n`;
    desc += `**Consensus Reached:** ${debate.consensus ? 'YES' : 'NO'} (${debate.rounds} rounds)\n`;
    desc += `**Final Risk Level:** ${debate.finalRecommendation.riskLevel}\n`;
    desc += `**Confidence:** ${(debate.finalRecommendation.confidence * 100).toFixed(0)}%\n\n`;

    desc += `### Affected Components (${debate.finalRecommendation.affectedComponents.length})\n\n`;
    debate.finalRecommendation.affectedComponents.forEach(comp => {
      desc += `- **${comp.name}** (${comp.type}) - ${comp.risk} risk\n`;
      desc += `  _${comp.reason}_\n`;
    });
    desc += `\n`;

    desc += `### Build Agent Recommendation\n\n`;
    desc += `${debate.finalRecommendation.recommendation}\n\n`;

    if (debate.sentinelApproval) {
      desc += `### Sentinel Agent Assessment\n\n`;
      desc += `${debate.sentinelApproval.reasoning}\n\n`;

      if (debate.sentinelApproval.concerns.length > 0) {
        desc += `**Remaining Concerns:**\n`;
        debate.sentinelApproval.concerns.forEach(concern => {
          desc += `- ${concern}\n`;
        });
        desc += `\n`;
      }
    }
  }

  desc += `## Recommended Actions\n\n`;
  desc += `1. Review affected components\n`;
  desc += `2. Update tests to cover new scenarios\n`;
  desc += `3. Test in sandbox environment\n`;
  desc += `4. Monitor rollout closely\n`;
  desc += `5. Prepare rollback plan\n\n`;

  desc += `---\n`;
  desc += `_Generated by Forerunner - Automated Release Update Testing_\n`;
  desc += `_Powered by Agentia Headless_\n`;

  return desc;
}

/**
 * Map risk level to Copado priority (integer)
 * 1 = High, 2 = Medium, 3 = Low
 */
function mapRiskToPriority(riskLevel) {
  const mapping = {
    'HIGH': 1,
    'MEDIUM': 2,
    'LOW': 3,
    'UNKNOWN': 2
  };
  return mapping[riskLevel] || 2;
}

/**
 * Create story via Agentia CICD (REAL API CALL)
 */
async function createAgentiaStory(story) {
  try {
    console.log(chalk.cyan('🤖 Calling Agentia CICD API...\n'));

    // Escape quotes for shell command
    const title = story.title.replace(/"/g, '\\"');
    const description = story.description.replace(/"/g, '\\"').replace(/\n/g, ' ');

    // Real Agentia CLI command
    // Note: Use --functional-requirements for description (max 30000 chars)
    // Priority: 1=High, 2=Medium, 3=Low
    const command = `agentia cicd work create --title "${title}" --functional-requirements "${description}" --priority ${story.priority} --json`;

    const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

    // Parse response
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (e) {
      // Some CLI versions may return non-JSON
      result = { result: stdout, stderr };
    }

    if (stderr && stderr.includes('error')) {
      return {
        success: false,
        error: stderr
      };
    }

    // Extract story ID from response
    const storyId = extractStoryId(result);

    return {
      success: true,
      storyId: storyId,
      status: result.status || 'New',
      url: result.url || `https://app.copado.com/stories/${storyId}`,
      rawResponse: result
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract story ID from Agentia response
 */
function extractStoryId(response) {
  // Try different response formats
  if (response.result?.id) return response.result.id;
  if (response.id) return response.id;
  if (response.storyId) return response.storyId;
  if (response.userStoryId) return response.userStoryId;

  // Try to extract from transactionId or other fields
  if (response.result?.transactionId) {
    return `TX-${response.result.transactionId}`;
  }

  return null;
}

/**
 * Save story reference for tracking
 */
async function saveStoryReference(updateId, storyResult) {
  const cacheDir = path.join(process.cwd(), '.forerunner-cache');
  const storyFile = path.join(cacheDir, `story-${updateId}.json`);

  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      storyFile,
      JSON.stringify({
        updateId,
        storyId: storyResult.storyId,
        status: storyResult.status,
        url: storyResult.url,
        createdAt: new Date().toISOString(),
        rawResponse: storyResult.rawResponse
      }, null, 2)
    );
  } catch (error) {
    // Non-fatal error
    console.log(chalk.dim('Note: Could not save story reference'));
  }
}

module.exports = storyCommand;
