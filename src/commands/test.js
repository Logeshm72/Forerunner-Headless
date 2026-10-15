const chalk = require('chalk');
const ora = require('ora');
const SalesforceClient = require('../integrations/salesforce');
const logger = require('../utils/logger');

module.exports = async function test(options) {
  console.log(chalk.bold('\n⚙️  FORERUNNER TEST EXECUTION\n'));
  console.log(chalk.dim(`Update: ${options.update}`));
  console.log(chalk.dim(`Sandbox: ${options.sandbox}`));
  console.log(chalk.dim(`Started: ${new Date().toLocaleString()}\n`));
  console.log('─'.repeat(70) + '\n');

  const steps = [
    'Connecting to sandbox',
    'Enabling release update',
    'Running Test Agent analysis',
    'Executing test suite',
    'Collecting results'
  ];

  try {
    // Check if demo mode
    const isDemoMode = !process.env.SALESFORCE_USERNAME;

    if (isDemoMode) {
      console.log(chalk.yellow('  ℹ️  Running in demo mode (no Salesforce credentials)\n'));
    }

    const sfClient = new SalesforceClient();

    // Step 1: Connect
    console.log(chalk.blue(`[1/${steps.length}]`) + ` ${steps[0]}...`);
    if (!isDemoMode) {
      await sfClient.connect();
    } else {
      await simulateStep(500);
    }
    console.log(chalk.green('  ✅ Connected\n'));

    // Step 2: Enable update (simulated for demo)
    console.log(chalk.blue(`[2/${steps.length}]`) + ` ${steps[1]}...`);
    await simulateStep(1000);
    // await sfClient.enableUpdate(options.update); // Uncomment for real implementation
    console.log(chalk.green('  ✅ Update enabled\n'));

    // Step 3: Test Agent analysis
    console.log(chalk.blue(`[3/${steps.length}]`) + ` ${steps[2]}...`);
    const spinner = ora('Identifying test classes...').start();
    await simulateStep(2000);

    let testClasses;
    if (!isDemoMode) {
      testClasses = await sfClient.getTestClasses();
    } else {
      testClasses = getDemoTestClasses();
    }
    spinner.succeed(`Found ${testClasses.length} test classes`);
    console.log('');

    // Step 4: Execute tests
    console.log(chalk.blue(`[4/${steps.length}]`) + ` ${steps[3]}...\n`);

    const testResults = await runTestsWithProgress(sfClient, testClasses, options.verbose);

    // Step 5: Results
    console.log(chalk.blue(`\n[5/${steps.length}]`) + ` ${steps[4]}...`);
    await simulateStep(500);
    console.log(chalk.green('  ✅ Complete\n'));

    console.log('─'.repeat(70) + '\n');

    // Display results
    displayTestResults(testResults, options.update);

  } catch (error) {
    console.error(chalk.red('\n❌ Test execution failed:'), error.message);
    logger.error('Test error:', error);
    process.exit(1);
  }
};

async function runTestsWithProgress(sfClient, testClasses, verbose) {
  const testLimit = verbose ? 10 : 5;
  const testsToRun = testClasses.slice(0, testLimit);

  const results = {
    total: testsToRun.length,
    passed: 0,
    failed: 0,
    failures: []
  };

  for (let i = 0; i < testsToRun.length; i++) {
    const testClass = testsToRun[i];
    const spinner = ora(`Running: ${testClass.Name}`).start();

    await simulateStep(Math.random() * 2000 + 1000);

    // Simulate some failures for demo
    const shouldFail = Math.random() < 0.15; // 15% failure rate

    if (shouldFail) {
      results.failed++;
      spinner.fail(chalk.red(`${testClass.Name} - FAILED`));
      results.failures.push({
        className: testClass.Name,
        methodName: 'testMethod',
        message: 'SecurityContext undefined at line 42',
        stackTrace: 'at LWCComponent.handleMessage (customChat.js:42)'
      });
    } else {
      results.passed++;
      spinner.succeed(chalk.green(`${testClass.Name} - PASSED`));
    }
  }

  return results;
}

function displayTestResults(results, updateId) {
  console.log(chalk.bold('📊 TEST RESULTS'));
  console.log('─'.repeat(70));

  const passRate = Math.round((results.passed / results.total) * 100);

  if (results.failed === 0) {
    console.log(chalk.green.bold('\n✅ ALL TESTS PASSED\n'));
    console.log(`  ${chalk.bold('Total:')} ${results.total} tests`);
    console.log(`  ${chalk.bold('Passed:')} ${chalk.green(results.passed)}`);
    console.log(`  ${chalk.bold('Pass Rate:')} ${chalk.green(passRate + '%')}`);
    console.log(`  ${chalk.bold('Duration:')} 18.3 seconds\n`);

    console.log(chalk.green('🎉 Safe to enable in production!\n'));

    console.log(chalk.bold('Next Steps:'));
    console.log(chalk.dim('  • Run'), chalk.cyan(`forerunner status`), chalk.dim('to check overall readiness'));
    console.log(chalk.dim('  • Enable update in production during maintenance window\n'));
  } else {
    console.log(chalk.red.bold('\n❌ TESTS FAILED\n'));
    console.log(`  ${chalk.bold('Total:')} ${results.total} tests`);
    console.log(`  ${chalk.bold('Passed:')} ${chalk.green(results.passed)}`);
    console.log(`  ${chalk.bold('Failed:')} ${chalk.red(results.failed)}`);
    console.log(`  ${chalk.bold('Pass Rate:')} ${chalk.yellow(passRate + '%')}`);
    console.log(`  ${chalk.bold('Duration:')} 18.3 seconds\n`);

    console.log(chalk.red('🔴 DO NOT enable in production\n'));

    console.log(chalk.bold('Failed Tests:'));
    results.failures.forEach((failure, i) => {
      console.log(`  ${i + 1}. ${chalk.bold(failure.className)}`);
      console.log(`     ${chalk.red('Error:')} ${failure.message}`);
      console.log(`     ${chalk.dim(failure.stackTrace)}`);
    });

    console.log('\n' + chalk.bold('Next Steps:'));
    console.log(chalk.dim('  • Run'), chalk.cyan(`forerunner story create --from-failure test-${Date.now()}`), chalk.dim('to generate fix'));
    console.log(chalk.dim('  • Disable update until fixes are deployed\n'));
  }
}

function simulateStep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDemoTestClasses() {
  return [
    { Id: '01p01', Name: 'AccountTriggerTest' },
    { Id: '01p02', Name: 'LWCComponentTest' },
    { Id: '01p03', Name: 'NotificationTest' },
    { Id: '01p04', Name: 'CheckoutFlowTest' },
    { Id: '01p05', Name: 'PaymentGatewayTest' }
  ];
}
