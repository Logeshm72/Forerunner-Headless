const axios = require('axios');
const chalk = require('chalk');

/**
 * Real Slack Integration
 * Posts Forerunner results to Slack channels
 */
class SlackNotifier {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;
  }

  /**
   * Send notification to Slack channel
   */
  async notify(message, options = {}) {
    if (!this.enabled) {
      console.log(chalk.dim('Slack webhook not configured, skipping notification'));
      return;
    }

    try {
      const payload = {
        text: message,
        channel: options.channel || '#releases',
        username: 'Forerunner Bot',
        icon_emoji: ':robot_face:',
        ...options
      };

      await axios.post(this.webhookUrl, payload);
      console.log(chalk.green('✓ Slack notification sent'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to send Slack notification:', error.message));
    }
  }

  /**
   * Format release update scan results for Slack
   */
  async notifyScanResults(updates) {
    const critical = updates.filter(u => u.Priority === 'Critical' || u.IsCritical);
    const autoEnabled = updates.filter(u => u.IsAutoEnabled);

    const message = {
      text: '🔍 Forerunner Release Update Scan Complete',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔍 Salesforce Release Update Scan'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Total Updates Found:* ${updates.length}\n*Critical Updates:* ${critical.length}\n*Auto-Enabled:* ${autoEnabled.length}`
          }
        },
        {
          type: 'divider'
        }
      ]
    };

    // Add critical updates
    if (critical.length > 0) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🔴 Critical Updates:*\n' + critical.slice(0, 3).map(u =>
            `• ${u.Title || u.title}`
          ).join('\n')
        }
      });
    }

    // Add action buttons
    message.blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View All Updates'
          },
          url: 'https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm'
        }
      ]
    });

    await this.notify(null, message);
  }

  /**
   * Format AI debate results for Slack
   */
  async notifyDebateResults(debateResult, updateInfo) {
    const riskEmoji = {
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    };

    const emoji = riskEmoji[debateResult.finalRecommendation.riskLevel] || '⚪';

    const message = {
      text: `${emoji} AI Debate Complete: ${updateInfo.Title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} AI Debate Analysis Complete`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Release Update:*\n${updateInfo.Title || updateInfo.title}`
            },
            {
              type: 'mrkdwn',
              text: `*Consensus:*\n${debateResult.consensus ? '✅ Reached' : '❌ Not Reached'}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Risk Level:*\n${debateResult.finalRecommendation.riskLevel}`
            },
            {
              type: 'mrkdwn',
              text: `*Debate Rounds:*\n${debateResult.rounds}`
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🏗️  Build Agent Recommendation:*\n${debateResult.finalRecommendation.recommendation.substring(0, 200)}...`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🛡️  Sentinel Agent Assessment:*\n${debateResult.sentinelApproval.reasoning}`
          }
        }
      ]
    };

    // Add affected components
    if (debateResult.finalRecommendation.affectedComponents?.length > 0) {
      const components = debateResult.finalRecommendation.affectedComponents.slice(0, 5);
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Affected Components:*\n' + components.map(c =>
            `• ${c.name} (${c.type}) - ${c.risk} risk`
          ).join('\n')
        }
      });
    }

    await this.notify(null, message);
  }

  /**
   * Notify when Copado story is created
   */
  async notifyStoryCreated(storyResult, updateId) {
    const message = {
      text: `📋 Copado Story Created for ${updateId}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 Copado Story Created'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Story ID:*\n${storyResult.storyId || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${storyResult.status || 'New'}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in Copado'
              },
              url: storyResult.url || 'https://app.copado.com',
              style: 'primary'
            }
          ]
        }
      ]
    };

    await this.notify(null, message);
  }

  /**
   * Send simple text notification
   */
  async sendSimple(text) {
    await this.notify(text);
  }
}

module.exports = SlackNotifier;
