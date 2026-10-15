#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}   ${chalk.bold.white('FORERUNNER')}                                      ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.dim('Automated Salesforce Release Update Analysis')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.dim('Powered by Agentia Headless')}                   ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════╝')}
`;

console.log(banner);

program
  .name('forerunner')
  .description('Automated Salesforce Release Update Testing with Agentia')
  .version(pkg.version);

// Interactive mode (recommended for new users)
program
  .command('interactive')
  .alias('i')
  .description('🎯 Interactive mode: Pick an update, analyze, and create story')
  .option('--refresh', 'Force refresh scan data')
  .action(require('./commands/interactive'));

// Scan command
program
  .command('scan')
  .description('Scan for new Salesforce release updates')
  .option('--org <org>', 'Salesforce org name')
  .option('--all-orgs', 'Scan all connected orgs')
  .option('--json', 'Output as JSON')
  .option('--demo', 'Run in demo mode with mock data')
  .action(require('./commands/scan'));

// Analyze command
program
  .command('analyze')
  .description('Analyze impact of release updates')
  .option('--update <id>', 'Specific update ID')
  .option('--with-debate', 'Include Sentinel debate')
  .option('--verbose', 'Verbose output')
  .option('--json', 'Output as JSON')
  .action(require('./commands/analyze'));

// Test command
program
  .command('test')
  .description('Test release update in sandbox')
  .requiredOption('--update <id>', 'Update ID to test')
  .option('--sandbox <name>', 'Sandbox org name', 'dev')
  .option('--verbose', 'Verbose output')
  .action(require('./commands/test'));

// Status command
program
  .command('status')
  .description('Show current status of release updates')
  .option('--org <org>', 'Specific org')
  .option('--all-orgs', 'Show all orgs')
  .action(require('./commands/report'));

// Story command
program
  .command('story')
  .description('Create Copado story via Agentia CICD')
  .requiredOption('--update <id>', 'Update ID')
  .option('--force', 'Create story without cached analysis')
  .action(require('./commands/story'));

// Readiness command
program
  .command('readiness')
  .description('Check org readiness for upcoming release')
  .option('--org <org>', 'Specific org', 'production')
  .action(async (options) => {
    console.log(chalk.blue(`\nChecking readiness for ${options.org}...\n`));
    console.log(chalk.yellow('Readiness check feature coming soon...'));
  });

// Help command enhancement
program.on('--help', () => {
  console.log('');
  console.log(chalk.bold('🎯 Quick Start:'));
  console.log(chalk.cyan('  $ forerunner interactive') + chalk.dim('  (Recommended - guided workflow)'));
  console.log('');
  console.log(chalk.bold('Examples:'));
  console.log('  $ forerunner scan --all-orgs');
  console.log('  $ forerunner analyze --update LMS-2027 --with-debate');
  console.log('  $ forerunner test --update LMS-2027 --sandbox dev');
  console.log('  $ forerunner status --all-orgs');
  console.log('');
  console.log(chalk.dim('For more information, visit: https://github.com/yourorg/forerunner'));
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

// Parse arguments
program.parse(process.argv);
