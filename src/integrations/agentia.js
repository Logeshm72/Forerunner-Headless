const { exec } = require('child_process');
const util = require('util');
const chalk = require('chalk');
const execPromise = util.promisify(exec);

class AgentiaClient {

  // Use Build Agent to analyze metadata impact
  async analyzeImpact(updateDescription, orgMetadata) {
    const prompt = `
      Analyze the impact of this Salesforce release update on the org:

      Release Update: ${updateDescription}

      Org Metadata:
      - ${orgMetadata.triggers.length} Apex Triggers
      - ${orgMetadata.apexClasses.length} Apex Classes
      - ${orgMetadata.lwcComponents.length} Lightning Web Components
      - ${orgMetadata.flows.length} Active Flows

      Identify which metadata components are likely affected and assign a risk level (HIGH/MEDIUM/LOW).

      Return JSON format:
      {
        "riskLevel": "HIGH|MEDIUM|LOW",
        "affectedComponents": [
          {"type": "ApexTrigger", "name": "AccountTrigger", "risk": "HIGH", "reason": "..."}
        ],
        "recommendation": "..."
      }
    `;

    // For hackathon demo, return mock analysis
    // In production, you would call Agentia CLI:
    // const command = `agentia build analyze --prompt "${prompt}" --json`;
    // const { stdout } = await execPromise(command);
    // return JSON.parse(stdout);

    return this.mockBuildAnalysis(updateDescription, orgMetadata);
  }

  // Use Test Agent to generate test plan
  async generateTestPlan(affectedComponents) {
    const prompt = `
      Create a comprehensive test plan for these affected Salesforce components:
      ${JSON.stringify(affectedComponents, null, 2)}

      Include:
      - Test scenarios for each component
      - Edge cases to cover
      - Recommended test classes

      Return JSON.
    `;

    // Mock for demo
    return {
      testScenarios: [
        'Test LWC component with new security context',
        'Verify guest user authentication flows',
        'Test mobile responsive behavior',
        'Validate payment gateway integration'
      ],
      estimatedTime: '2 hours',
      priority: 'HIGH'
    };
  }

  // SENTINEL AGENT - Critique the analysis
  async sentinelCritique(buildAgentRecommendation, verbose = false) {
    if (verbose) {
      console.log(chalk.red('\n🛡️  Sentinel Agent analyzing...\n'));
    }

    const prompt = `
      You are the Sentinel Agent - a skeptical critic who challenges recommendations.

      Review this recommendation from the Build Agent:
      ${JSON.stringify(buildAgentRecommendation, null, 2)}

      Your job is to:
      1. Find weaknesses in the analysis
      2. Identify untested scenarios
      3. Raise concerns about edge cases
      4. Challenge the risk assessment

      Be critical but constructive. What could go wrong?

      Return JSON:
      {
        "agrees": true|false,
        "concerns": ["concern1", "concern2"],
        "additionalTests": ["test scenario 1", "test scenario 2"],
        "revisedRiskLevel": "HIGH|MEDIUM|LOW",
        "reasoning": "..."
      }
    `;

    // Mock Sentinel response
    return this.mockSentinelCritique(buildAgentRecommendation);
  }

  // Orchestrate debate between Build and Sentinel
  async runDebate(updateInfo, orgMetadata, verbose = false) {
    if (verbose) {
      console.log(chalk.dim('Initializing multi-agent debate system...\n'));
    }

    let rounds = 0;
    let consensus = false;
    let buildPosition, sentinelPosition;

    // Round 1: Initial positions
    console.log(chalk.bold('Round 1: Initial Positions\n'));

    if (verbose) console.log(chalk.cyan('🏗️  Build Agent analyzing...'));
    buildPosition = await this.analyzeImpact(
      updateInfo.Description || updateInfo.title,
      orgMetadata
    );

    if (verbose) {
      console.log(chalk.dim('  Risk Level:'), buildPosition.riskLevel);
      console.log(chalk.dim('  Recommendation:'), buildPosition.recommendation.substring(0, 60) + '...\n');
    }

    sentinelPosition = await this.sentinelCritique(buildPosition, verbose);

    if (verbose) {
      console.log(chalk.dim('  Agrees:'), sentinelPosition.agrees);
      console.log(chalk.dim('  Concerns:'), sentinelPosition.concerns.length);
    }

    rounds++;

    // Round 2: Refinement
    if (!sentinelPosition.agrees && rounds < 3) {
      rounds++;
      console.log(chalk.bold(`\nRound ${rounds}: Addressing Concerns\n`));

      if (verbose) {
        console.log(chalk.cyan('🏗️  Build Agent refining analysis...'));
      }

      // Build agent considers Sentinel's concerns
      buildPosition = await this.refineAnalysis(buildPosition, sentinelPosition);

      if (verbose) {
        console.log(chalk.dim('  Updated risk:'), buildPosition.riskLevel);
        console.log(chalk.dim('  Additional tests added:'), sentinelPosition.additionalTests.length, '\n');
      }

      sentinelPosition = await this.finalSentinelAssessment(buildPosition);
      consensus = sentinelPosition.agrees;
    } else {
      consensus = true;
    }

    // Round 3: Final consensus (if needed)
    if (!consensus && rounds < 3) {
      rounds++;
      console.log(chalk.bold(`\nRound ${rounds}: Final Review\n`));
      consensus = true; // Force consensus for demo
      sentinelPosition.agrees = true;
      sentinelPosition.reasoning = 'After addressing concerns and adding additional tests, the approach is acceptable with monitoring.';
    }

    return {
      consensus,
      rounds,
      finalRecommendation: buildPosition,
      sentinelApproval: sentinelPosition,
      updateId: updateInfo.Id || updateInfo.id
    };
  }

  // Helper methods for mock data
  mockBuildAnalysis(description, metadata) {
    return {
      riskLevel: 'HIGH',
      affectedComponents: [
        {
          type: 'LightningComponent',
          name: 'customChat',
          risk: 'HIGH',
          reason: 'Uses Lightning Message Service, requires new security context'
        },
        {
          type: 'LightningComponent',
          name: 'notificationPanel',
          risk: 'HIGH',
          reason: 'LMS subscription needs security context wrapper'
        },
        {
          type: 'ApexClass',
          name: 'MessageController',
          risk: 'MEDIUM',
          reason: 'Handles LMS backend logic'
        }
      ],
      recommendation: 'Test thoroughly before production. Update affects critical checkout flow components. Estimated fix time: 4-6 hours.',
      confidence: 0.85
    };
  }

  mockSentinelCritique(buildAnalysis) {
    return {
      agrees: false,
      concerns: [
        'Affected components are in critical checkout path - high business impact',
        'Guest user authentication scenarios not mentioned in analysis',
        'Mobile vs desktop behavior differences not considered',
        'Historical incident: Similar LWC security update caused production issues in 2025',
        'Test coverage only 73% - untested code paths could break'
      ],
      additionalTests: [
        'Test guest user checkout flow with new security context',
        'Verify mobile responsive behavior maintains security',
        'Test integration with external payment gateway',
        'Validate error handling when security context fails'
      ],
      revisedRiskLevel: 'HIGH',
      reasoning: 'While Build Agent analysis is sound, the critical nature of affected components and historical precedent warrant extreme caution. Additional testing required before production deployment.'
    };
  }

  async refineAnalysis(original, sentinelFeedback) {
    // Simulate refinement
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      ...original,
      affectedComponents: [
        ...original.affectedComponents,
        {
          type: 'GuestUserFlow',
          name: 'CheckoutFlow',
          risk: 'HIGH',
          reason: 'Guest user scenarios now included per Sentinel feedback'
        }
      ],
      recommendation: original.recommendation + ' Additional testing added for guest users, mobile scenarios, and payment integration.',
      confidence: 0.92,
      addressedConcerns: sentinelFeedback.concerns.length
    };
  }

  async finalSentinelAssessment(refinedAnalysis) {
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      agrees: true,
      concerns: [
        'Still recommend close monitoring during rollout'
      ],
      additionalTests: [],
      revisedRiskLevel: 'MEDIUM',
      reasoning: 'Significant improvements made. Additional test coverage addresses major concerns. Recommend deployment with monitoring and rollback plan ready.',
      confidence: 0.90
    };
  }
}

module.exports = AgentiaClient;
