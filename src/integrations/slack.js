const { WebClient } = require('@slack/web-api');
require('dotenv').config();

class SlackClient {
  constructor() {
    if (process.env.SLACK_BOT_TOKEN) {
      this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
      this.channel = process.env.SLACK_CHANNEL || '#releases';
    }
  }

  async sendDebateResults(update, debateResult) {
    if (!this.client) {
      console.log('Slack not configured, skipping notification');
      return;
    }

    const message = {
      channel: this.channel,
      text: `Forerunner Analysis: ${update.Title || update.title}`,
      blocks: this.buildDebateBlocks(update, debateResult)
    };

    try {
      await this.client.chat.postMessage(message);
    } catch (error) {
      console.error('Failed to send Slack message:', error.message);
    }
  }

  buildDebateBlocks(update, debateResult) {
    const rec = debateResult.finalRecommendation;
    const sent = debateResult.sentinelApproval;

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔍 Forerunner Analysis Complete'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Update:* ${update.Title || update.title}\n*Status:* ${update.Status || update.status}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Debate Rounds:*\n${debateResult.rounds}`
          },
          {
            type: 'mrkdwn',
            text: `*Consensus:*\n${debateResult.consensus ? '✅ Reached' : '❌ No agreement'}`
          },
          {
            type: 'mrkdwn',
            text: `*Risk Level:*\n${this.getRiskEmoji(rec.riskLevel)} ${rec.riskLevel}`
          },
          {
            type: 'mrkdwn',
            text: `*Affected Components:*\n${rec.affectedComponents?.length || 0}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Build Agent Recommendation:*\n${rec.recommendation}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Sentinel Assessment:*\n${sent.reasoning}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Test Now'
            },
            style: 'primary',
            value: update.Id || update.id,
            action_id: 'test_update'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            value: update.Id || update.id,
            action_id: 'view_details'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Ignore'
            },
            style: 'danger',
            value: update.Id || update.id,
            action_id: 'ignore_update'
          }
        ]
      }
    ];
  }

  getRiskEmoji(risk) {
    const emojis = {
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    };
    return emojis[risk] || '⚪';
  }

  async sendTestResults(update, testResults) {
    if (!this.client) return;

    const passed = testResults.passed || 0;
    const failed = testResults.failed || 0;
    const total = passed + failed;
    const status = failed === 0 ? '✅ PASSED' : '❌ FAILED';

    const message = {
      channel: this.channel,
      text: `Test Results: ${update.Title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${status} - Test Results`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Update:* ${update.Title}\n*Tests:* ${passed}/${total} passed`
          }
        }
      ]
    };

    try {
      await this.client.chat.postMessage(message);
    } catch (error) {
      console.error('Failed to send test results:', error.message);
    }
  }
}

module.exports = SlackClient;
