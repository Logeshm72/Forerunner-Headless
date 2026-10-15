const ora = require('ora');
const chalk = require('chalk');
const SalesforceClient = require('../integrations/salesforce');
// Use REAL Agentia AI (not mock!)
const AgentiaClient = require('../integrations/agentia-real');
const SlackClient = require('../integrations/slack');
const { loadCache } = require('../utils/cache');
const logger = require('../utils/logger');

module.exports = async function analyze(options) {
  const spinner = ora('Analyzing impact...').start();

  try {
    // Load cached updates
    const cached = loadCache('release-updates');
    if (!cached || !cached.updates) {
      spinner.fail('No cached updates found. Run "forerunner scan" first.');
      process.exit(1);
    }

    // Find the update
    const update = cached.updates.find(u =>
      u.Id?.includes(options.update) || u.id?.includes(options.update)
    );

    if (!update) {
      spinner.fail(`Update "${options.update}" not found`);
      console.log(chalk.dim('\n💡 Run "forerunner scan" to refresh available updates\n'));
      process.exit(1);
    }

    // Use demo mode if cache is demo or no SF credentials
    const isDemoMode = cached.demo || !process.env.SALESFORCE_USERNAME;

    let metadata;
    if (isDemoMode) {
      spinner.text = 'Loading demo org metadata...';
      metadata = getDemoMetadata();
    } else {
      spinner.text = 'Connecting to Salesforce...';
      const sfClient = new SalesforceClient();
      await sfClient.connect();

      spinner.text = 'Fetching org metadata...';
      metadata = await sfClient.getMetadata();
    }

    logger.info('Metadata summary:', {
      triggers: metadata.triggers.length,
      classes: metadata.apexClasses.length,
      lwcs: metadata.lwcComponents.length,
      flows: metadata.flows.length
    });

    if (options.withDebate) {
      spinner.text = 'Initializing agent debate...';

      const agentiaClient = new AgentiaClient();

      console.log('\n' + chalk.bold('🤝 AGENT DEBATE SESSION'));
      console.log('═'.repeat(70));

      // Run the debate
      const debateResult = await agentiaClient.runDebate(update, metadata, options.verbose);

      spinner.succeed('Debate complete');

      // Display results
      displayDebateResults(debateResult);

      // Send to Slack if configured
      if (process.env.SLACK_BOT_TOKEN) {
        const slackClient = new SlackClient();
        await slackClient.sendDebateResults(update, debateResult);
        console.log(chalk.dim('\n✉️  Results sent to Slack\n'));
      }

    } else {
      // Simple analysis without debate
      spinner.text = 'Running Build Agent analysis...';

      const agentiaClient = new AgentiaClient();
      const analysis = await agentiaClient.analyzeImpactWithBuildAgent(
        update.Description || update.title,
        metadata
      );

      spinner.succeed('Analysis complete');

      displaySimpleAnalysis(analysis);
    }

    // JSON output
    if (options.json) {
      // Output JSON version
    }

  } catch (error) {
    spinner.fail('Analysis failed');
    logger.error('Analysis error:', error);
    process.exit(1);
  }
};

function displayDebateResults(debateResult) {
  console.log('\n' + chalk.bold('📊 DEBATE OUTCOME'));
  console.log('─'.repeat(70));
  console.log(`${chalk.bold('Rounds:')} ${debateResult.rounds}`);
  console.log(`${chalk.bold('Consensus:')} ${debateResult.consensus ? chalk.green('✅ Reached') : chalk.red('❌ Not reached')}`);
  console.log('');

  // Final recommendation
  console.log(chalk.bold.cyan('🏗️  BUILD AGENT - Final Recommendation:'));
  console.log('─'.repeat(70));
  const rec = debateResult.finalRecommendation;
  console.log(`${chalk.bold('Risk Level:')} ${getRiskBadge(rec.riskLevel)}`);
  console.log(`${chalk.bold('Affected Components:')} ${rec.affectedComponents?.length || 0}`);
  console.log(`${chalk.bold('Recommendation:')} ${rec.recommendation}`);

  if (rec.affectedComponents && rec.affectedComponents.length > 0) {
    console.log('\n' + chalk.bold('Affected Components:'));
    rec.affectedComponents.slice(0, 5).forEach(comp => {
      console.log(`  ${getRiskBadge(comp.risk)} ${chalk.bold(comp.name)} (${comp.type})`);
      console.log(`     ${chalk.dim(comp.reason)}`);
    });
    if (rec.affectedComponents.length > 5) {
      console.log(chalk.dim(`  ... and ${rec.affectedComponents.length - 5} more`));
    }
  }

  // Sentinel assessment
  console.log('\n' + chalk.bold.red('🛡️  SENTINEL AGENT - Assessment:'));
  console.log('─'.repeat(70));
  const sent = debateResult.sentinelApproval;
  console.log(`${chalk.bold('Agrees:')} ${sent.agrees ? chalk.green('✅ Yes') : chalk.yellow('⚠️  With concerns')}`);
  console.log(`${chalk.bold('Revised Risk:')} ${getRiskBadge(sent.revisedRiskLevel)}`);

  if (sent.concerns && sent.concerns.length > 0) {
    console.log('\n' + chalk.bold('Concerns Raised:'));
    sent.concerns.forEach((concern, i) => {
      console.log(`  ${i + 1}. ${concern}`);
    });
  }

  if (sent.additionalTests && sent.additionalTests.length > 0) {
    console.log('\n' + chalk.bold('Additional Tests Recommended:'));
    sent.additionalTests.forEach((test, i) => {
      console.log(`  ${i + 1}. ${test}`);
    });
  }

  console.log('\n' + chalk.bold('Next Steps:'));
  console.log(chalk.dim('  • Run'), chalk.cyan(`forerunner test --update ${debateResult.updateId}`), chalk.dim('to test in sandbox'));
  console.log(chalk.dim('  • Review concerns and run additional tests as needed\n'));
}

function displaySimpleAnalysis(analysis) {
  console.log('\n' + chalk.bold('📊 IMPACT ANALYSIS'));
  console.log('─'.repeat(70));
  console.log(`${chalk.bold('Risk Level:')} ${getRiskBadge(analysis.riskLevel)}`);
  console.log(`${chalk.bold('Affected Components:')} ${analysis.affectedComponents?.length || 0}`);
  console.log(`${chalk.bold('Recommendation:')} ${analysis.recommendation}`);
  console.log('');
}

function getRiskBadge(risk) {
  const badges = {
    'HIGH': chalk.red.bold('🔴 HIGH'),
    'MEDIUM': chalk.yellow.bold('🟡 MEDIUM'),
    'LOW': chalk.green.bold('🟢 LOW')
  };
  return badges[risk] || risk;
}

function getDemoMetadata() {
  return {
    triggers: [
      { Id: '01q1', Name: 'AccountTrigger', Status: 'Active' },
      { Id: '01q2', Name: 'OpportunityTrigger', Status: 'Active' },
      { Id: '01q3', Name: 'ContactTrigger', Status: 'Active' }
    ],
    apexClasses: [
      { Id: '01p1', Name: 'AccountController' },
      { Id: '01p2', Name: 'MessageController' },
      { Id: '01p3', Name: 'PaymentGateway' }
    ],
    lwcComponents: [
      { Id: '0Rb1', DeveloperName: 'customChat' },
      { Id: '0Rb2', DeveloperName: 'notificationPanel' },
      { Id: '0Rb3', DeveloperName: 'checkoutFlow' }
    ],
    flows: [
      { Id: '301', MasterLabel: 'Checkout Flow', ProcessType: 'Flow' },
      { Id: '302', MasterLabel: 'Approval Process', ProcessType: 'Flow' }
    ]
  };
}
