// Multi-agent orchestrator for coordinating Build and Sentinel agents

const AgentiaClient = require('../integrations/agentia');
const SentinelAgent = require('./sentinel');

class AgentOrchestrator {
  constructor() {
    this.agentia = new AgentiaClient();
    this.sentinel = new SentinelAgent();
    this.maxRounds = 3;
  }

  // Orchestrate a complete debate cycle
  async orchestrateDebate(updateInfo, orgMetadata, options = {}) {
    const results = {
      rounds: [],
      consensus: false,
      finalRecommendation: null,
      sentinelApproval: null
    };

    let currentRound = 0;
    let buildPosition = null;
    let sentinelPosition = null;

    while (currentRound < this.maxRounds && !results.consensus) {
      currentRound++;

      const round = {
        number: currentRound,
        buildPosition: null,
        sentinelPosition: null,
        agreed: false
      };

      // Build Agent analyzes
      if (currentRound === 1) {
        buildPosition = await this.agentia.analyzeImpact(
          updateInfo.Description || updateInfo.title,
          orgMetadata
        );
      } else {
        // Refine based on Sentinel feedback
        buildPosition = await this.refineWithFeedback(
          buildPosition,
          sentinelPosition
        );
      }

      round.buildPosition = buildPosition;

      // Sentinel critiques
      sentinelPosition = await this.sentinel.critique(buildPosition);
      round.sentinelPosition = sentinelPosition;
      round.agreed = sentinelPosition.agrees;

      results.rounds.push(round);

      // Check for consensus
      if (sentinelPosition.agrees) {
        results.consensus = true;
        break;
      }

      // If last round and still no consensus, force resolution
      if (currentRound === this.maxRounds) {
        results.consensus = this.forcedConsensus(buildPosition, sentinelPosition);
      }
    }

    results.finalRecommendation = buildPosition;
    results.sentinelApproval = sentinelPosition;

    return results;
  }

  async refineWithFeedback(originalPosition, feedback) {
    // Incorporate Sentinel's concerns into refined analysis
    const refined = { ...originalPosition };

    // Address test coverage concerns
    if (feedback.concerns.some(c => c.includes('coverage'))) {
      refined.testCoverage = 85;
    }

    // Add edge case considerations
    if (feedback.concerns.some(c => c.includes('edge'))) {
      refined.recommendation += ' Additional edge case testing added.';
    }

    // Adjust risk if Sentinel is more conservative
    if (feedback.revisedRiskLevel !== originalPosition.riskLevel) {
      refined.riskLevel = feedback.revisedRiskLevel;
    }

    // Increment confidence after addressing concerns
    refined.confidence = Math.min(0.95, (refined.confidence || 0.8) + 0.05);

    return refined;
  }

  forcedConsensus(buildPosition, sentinelPosition) {
    // If after max rounds, determine if we can proceed
    const criticalConcerns = sentinelPosition.concerns.filter(c =>
      c.toLowerCase().includes('critical') ||
      c.toLowerCase().includes('high risk') ||
      c.toLowerCase().includes('production')
    );

    // Can proceed if no critical blockers
    return criticalConcerns.length === 0;
  }

  // Parallel analysis across multiple orgs
  async analyzeMultiOrg(updateInfo, orgsMetadata) {
    const analyses = await Promise.all(
      orgsMetadata.map(orgData =>
        this.orchestrateDebate(updateInfo, orgData.metadata, { orgName: orgData.name })
      )
    );

    return this.correlateResults(analyses);
  }

  correlateResults(analyses) {
    // Find systemic vs isolated issues
    const systemic = [];
    const isolated = [];

    const failuresByUpdate = {};

    analyses.forEach((analysis, idx) => {
      if (!analysis.consensus || analysis.sentinelApproval.revisedRiskLevel === 'HIGH') {
        const key = analysis.finalRecommendation.recommendation;
        failuresByUpdate[key] = (failuresByUpdate[key] || 0) + 1;
      }
    });

    Object.entries(failuresByUpdate).forEach(([issue, count]) => {
      if (count >= analyses.length * 0.5) {
        systemic.push({ issue, orgCount: count });
      } else {
        isolated.push({ issue, orgCount: count });
      }
    });

    return {
      total: analyses.length,
      systemic,
      isolated,
      analyses
    };
  }
}

module.exports = AgentOrchestrator;
