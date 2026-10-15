const chalk = require('chalk');

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

class Logger {
  error(message, ...args) {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(chalk.red('❌ ERROR:'), message, ...args);
    }
  }

  warn(message, ...args) {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(chalk.yellow('⚠️  WARN:'), message, ...args);
    }
  }

  info(message, ...args) {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log(chalk.blue('ℹ️  INFO:'), message, ...args);
    }
  }

  debug(message, ...args) {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(chalk.gray('🔍 DEBUG:'), message, ...args);
    }
  }

  success(message, ...args) {
    console.log(chalk.green('✅'), message, ...args);
  }
}

module.exports = new Logger();
