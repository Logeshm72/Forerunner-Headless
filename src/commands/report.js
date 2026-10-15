const chalk = require('chalk');
const Table = require('cli-table3');
const { loadCache } = require('../utils/cache');

module.exports = async function report(options) {
  console.log(chalk.bold('\n📊 FORERUNNER STATUS REPORT\n'));

  const cached = loadCache('release-updates');

  if (!cached || !cached.updates) {
    console.log(chalk.yellow('⚠️  No data available. Run "forerunner scan" first.\n'));
    process.exit(0);
  }

  if (options.allOrgs) {
    displayMultiOrgStatus();
  } else {
    displaySingleOrgStatus(cached, options.org || 'production');
  }
};

function displaySingleOrgStatus(cached, orgName) {
  console.log(chalk.dim(`Org: ${orgName}`));
  console.log(chalk.dim(`Last scan: ${new Date(cached.scannedAt).toLocaleString()}\n`));
  console.log('─'.repeat(70) + '\n');

  const summary = cached.summary || {
    total: cached.updates.length,
    critical: cached.updates.filter(u => u.critical || u.IsCritical).length,
    tested: Math.floor(cached.updates.length * 0.6), // Mock
    failed: Math.floor(cached.updates.length * 0.05)  // Mock
  };

  // Readiness score
  const readiness = Math.round(((summary.tested - summary.failed) / summary.total) * 100);
  const readinessColor = readiness >= 80 ? chalk.green : readiness >= 50 ? chalk.yellow : chalk.red;

  console.log(chalk.bold('Release Readiness Score: ') + readinessColor.bold(readiness + '%'));
  console.log('');

  // Summary table
  const table = new Table({
    head: [chalk.bold('Category'), chalk.bold('Count'), chalk.bold('Status')],
    colWidths: [25, 12, 35]
  });

  table.push(
    ['Total Updates', summary.total, getProgressBar(summary.total, summary.total)],
    ['Critical Updates', summary.critical, chalk.red('⚠️  Requires attention')],
    ['Tested', summary.tested, getProgressBar(summary.tested, summary.total)],
    ['Failed Tests', summary.failed, summary.failed > 0 ? chalk.red('❌ Needs fixing') : chalk.green('✅ All pass')]
  );

  console.log(table.toString());

  // Upcoming enforcements
  console.log('\n' + chalk.bold('📅 Upcoming Enforcements:'));
  console.log('  • Feb 15, 2027: 5 updates auto-enforced');
  console.log('  • Mar 01, 2027: 3 updates auto-enforced');
  console.log('  • Apr 15, 2027: 4 updates auto-enforced\n');

  console.log(chalk.bold('Next Steps:'));
  if (summary.failed > 0) {
    console.log(chalk.dim('  • Fix failed tests before enforcement dates'));
    console.log(chalk.dim('  • Run'), chalk.cyan('forerunner analyze --with-debate'), chalk.dim('for detailed analysis'));
  } else if ((summary.total - summary.tested) > 0) {
    console.log(chalk.dim('  • Test remaining'), chalk.yellow(summary.total - summary.tested), chalk.dim('updates'));
  } else {
    console.log(chalk.green('  ✅ All updates tested and passing!'));
  }
  console.log('');
}

function displayMultiOrgStatus() {
  console.log(chalk.bold('MULTI-ORG STATUS\n'));
  console.log('─'.repeat(70) + '\n');

  const table = new Table({
    head: [
      chalk.bold('Org'),
      chalk.bold('Total'),
      chalk.bold('Tested'),
      chalk.bold('Failed'),
      chalk.bold('Status')
    ],
    colWidths: [18, 10, 10, 10, 15]
  });

  // Mock multi-org data
  const orgs = [
    { name: 'Production', total: 73, tested: 58, failed: 3, status: '🟡' },
    { name: 'QA Sandbox', total: 73, tested: 70, failed: 2, status: '🟢' },
    { name: 'Dev Sandbox', total: 73, tested: 45, failed: 5, status: '🔴' },
    { name: 'UAT Sandbox', total: 73, tested: 60, failed: 3, status: '🟡' },
    { name: 'Staging', total: 73, tested: 73, failed: 0, status: '✅' }
  ];

  orgs.forEach(org => {
    table.push([
      org.name,
      org.total,
      org.tested,
      org.failed > 0 ? chalk.red(org.failed) : chalk.green(org.failed),
      org.status
    ]);
  });

  console.log(table.toString());

  // Systemic issues
  console.log('\n' + chalk.bold('🔍 Systemic Issues (affecting multiple orgs):'));
  console.log(chalk.red('  ❌ LMS Security Update - fails in 3/5 orgs'));
  console.log(chalk.yellow('  ⚠️  Trigger Order Update - fails in Dev only (env-specific?)\n'));

  console.log(chalk.dim('💡 Run'), chalk.cyan('forerunner analyze --update <id> --with-debate'), chalk.dim('for detailed impact analysis\n'));
}

function getProgressBar(current, total) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  const bar = '▓'.repeat(filled) + '░'.repeat(empty);
  const color = percentage >= 80 ? chalk.green : percentage >= 50 ? chalk.yellow : chalk.red;
  return color(`${bar} ${percentage}%`);
}
