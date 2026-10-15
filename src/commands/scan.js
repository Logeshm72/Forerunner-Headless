const ora = require('ora');
const chalk = require('chalk');
const Table = require('cli-table3');
const SalesforceClient = require('../integrations/salesforce');
const { saveCache } = require('../utils/cache');
const logger = require('../utils/logger');

module.exports = async function scan(options) {
  const spinner = ora('Scanning for Salesforce release updates...').start();

  try {
    // Demo mode for hackathon
    if (options.demo || process.env.DEMO_MODE === 'true') {
      spinner.succeed('Demo mode: Using mock data');
      return displayMockResults(options);
    }

    const sfClient = new SalesforceClient();
    await sfClient.connect();

    const updates = await sfClient.getReleaseUpdates();

    spinner.succeed(`Found ${chalk.bold(updates.length)} release updates`);

    // Categorize by priority
    const critical = updates.filter(u => u.IsCritical);
    const autoEnabled = updates.filter(u => u.IsAutoEnabled);
    const optional = updates.filter(u => !u.IsCritical && !u.IsAutoEnabled);

    // Display summary
    console.log('\n' + chalk.bold('📊 RELEASE UPDATE SUMMARY'));
    console.log('─'.repeat(70));
    console.log(chalk.red(`🔴 Critical (auto-enforced): ${critical.length}`));
    console.log(chalk.yellow(`🟡 Auto-enabled: ${autoEnabled.length}`));
    console.log(chalk.green(`🟢 Optional: ${optional.length}`));
    console.log('');

    // Show critical updates in table
    if (critical.length > 0) {
      console.log(chalk.bold('⚠️  CRITICAL UPDATES:\n'));

      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Title'),
          chalk.bold('Status'),
          chalk.bold('Enforcement Date')
        ],
        colWidths: [15, 45, 12, 18],
        style: {
          head: ['cyan']
        }
      });

      critical.slice(0, 10).forEach(update => {
        const daysUntil = calculateDaysUntil(update.TargetDate);
        const dateDisplay = update.TargetDate
          ? `${update.TargetDate} (${daysUntil}d)`
          : 'TBD';

        table.push([
          update.Id.substr(0, 12),
          update.Title.substr(0, 42) + (update.Title.length > 42 ? '...' : ''),
          getStatusBadge(update.Status),
          dateDisplay
        ]);
      });

      console.log(table.toString());

      if (critical.length > 10) {
        console.log(chalk.dim(`\n... and ${critical.length - 10} more critical updates`));
      }
    }

    // Save to cache for later use
    saveCache('release-updates', {
      scannedAt: new Date().toISOString(),
      updates: updates,
      summary: {
        total: updates.length,
        critical: critical.length,
        autoEnabled: autoEnabled.length,
        optional: optional.length
      }
    });

    // Next steps
    console.log('\n' + chalk.bold('Next Steps:'));
    console.log(chalk.dim('  • Run'), chalk.cyan('forerunner analyze --with-debate'), chalk.dim('to assess impact'));
    console.log(chalk.dim('  • Run'), chalk.cyan('forerunner test --update <id>'), chalk.dim('to test in sandbox'));
    console.log(chalk.dim('  • Run'), chalk.cyan('forerunner status --all-orgs'), chalk.dim('for multi-org view\n'));

    // JSON output
    if (options.json) {
      console.log('\n' + JSON.stringify({ updates, summary: { critical: critical.length, autoEnabled: autoEnabled.length, optional: optional.length } }, null, 2));
    }

  } catch (error) {
    spinner.fail('Scan failed');
    logger.error('Scan error:', error);

    if (error.message.includes('INVALID_LOGIN')) {
      console.log(chalk.yellow('\n💡 Tip: Check your Salesforce credentials in .env file'));
    }

    process.exit(1);
  }
};

function displayMockResults(options) {
  const mockUpdates = generateMockUpdates();

  console.log('\n' + chalk.bold('📊 RELEASE UPDATE SUMMARY'));
  console.log(chalk.dim('(Demo Mode - Mock Data)'));
  console.log('─'.repeat(70));
  console.log(chalk.red(`🔴 Critical (auto-enforced): 12`));
  console.log(chalk.yellow(`🟡 Auto-enabled: 28`));
  console.log(chalk.green(`🟢 Optional: 33`));
  console.log('');

  const table = new Table({
    head: [chalk.bold('ID'), chalk.bold('Title'), chalk.bold('Status'), chalk.bold('Enforcement')],
    colWidths: [15, 45, 12, 18]
  });

  mockUpdates.forEach(update => {
    table.push([
      update.id,
      update.title,
      getStatusBadge(update.status),
      update.enforcement
    ]);
  });

  console.log(table.toString());
  console.log('\n' + chalk.dim('💡 Run without --demo flag to scan real Salesforce org\n'));

  // Save mock data
  saveCache('release-updates', {
    scannedAt: new Date().toISOString(),
    updates: mockUpdates,
    demo: true
  });
}

function generateMockUpdates() {
  return [
    {
      id: 'RU-LMS-2027',
      title: 'Lightning Message Service Security Update',
      status: 'Preview',
      enforcement: '2027-02-15 (90d)',
      critical: true
    },
    {
      id: 'RU-TRG-2027',
      title: 'Apex Trigger Execution Order Changes',
      status: 'Preview',
      enforcement: '2027-03-01 (105d)',
      critical: true
    },
    {
      id: 'RU-API-2027',
      title: 'API Version 60.0 Enforcement',
      status: 'Enabled',
      enforcement: '2027-04-01 (135d)',
      critical: true
    },
    {
      id: 'RU-FLW-2027',
      title: 'Flow Interview Limit Increase',
      status: 'Preview',
      enforcement: '2027-02-20 (95d)',
      critical: false
    },
    {
      id: 'RU-SEC-2027',
      title: 'Enhanced Guest User Security',
      status: 'Preview',
      enforcement: '2027-03-15 (120d)',
      critical: true
    }
  ];
}

function getStatusBadge(status) {
  const badges = {
    'Preview': chalk.yellow('⏸️  Preview'),
    'Enabled': chalk.green('✅ Enabled'),
    'Disabled': chalk.red('⏹️  Disabled'),
    'Active': chalk.blue('▶️  Active')
  };
  return badges[status] || status;
}

function calculateDaysUntil(targetDate) {
  if (!targetDate) return '?';
  const target = new Date(targetDate);
  const now = new Date();
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
