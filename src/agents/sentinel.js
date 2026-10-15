// Sentinel Agent - Adversarial critic for validating recommendations

class SentinelAgent {
  constructor() {
    this.concerns = [];
    this.criticalityThreshold = 0.7;
  }

  // Analyze a recommendation and provide critique
  async critique(recommendation) {
    const concerns = [];
    const additionalTests = [];

    // Check for critical components
    if (this.hasCriticalComponents(recommendation)) {
      concerns.push('Affected components are in critical business flow - high impact if broken');
      additionalTests.push('Test critical path end-to-end scenarios');
    }

    // Check test coverage
    if (this.hasLowTestCoverage(recommendation)) {
      concerns.push('Test coverage appears insufficient for comprehensive validation');
      additionalTests.push('Increase test coverage to 85%+ before production');
    }

    // Check for edge cases
    if (this.missingEdgeCases(recommendation)) {
      concerns.push('Edge cases not fully addressed in analysis');
      additionalTests.push('Test guest users, mobile devices, and error scenarios');
    }

    // Check historical risks
    if (this.hasHistoricalRisk(recommendation)) {
      concerns.push('Similar updates have caused production issues in the past');
      additionalTests.push('Review past incident reports and add regression tests');
    }

    // Assess whether to agree
    const agrees = concerns.length <= 2 && recommendation.confidence > this.criticalityThreshold;

    return {
      agrees,
      concerns,
      additionalTests,
      revisedRiskLevel: this.assessRisk(recommendation, concerns.length),
      reasoning: this.generateReasoning(agrees, concerns),
      confidence: this.calculateConfidence(recommendation, concerns.length)
    };
  }

  hasCriticalComponents(rec) {
    return rec.affectedComponents?.some(c =>
      c.name?.toLowerCase().includes('checkout') ||
      c.name?.toLowerCase().includes('payment') ||
      c.reason?.toLowerCase().includes('critical')
    );
  }

  hasLowTestCoverage(rec) {
    return !rec.testCoverage || rec.testCoverage < 80;
  }

  missingEdgeCases(rec) {
    const edgeCaseKeywords = ['guest', 'mobile', 'error', 'null', 'exception'];
    return !edgeCaseKeywords.some(keyword =>
      rec.recommendation?.toLowerCase().includes(keyword)
    );
  }

  hasHistoricalRisk(rec) {
    // In a real system, check historical incident database
    return rec.affectedComponents?.some(c => c.type === 'LightningComponent');
  }

  assessRisk(recommendation, concernCount) {
    if (concernCount >= 4) return 'HIGH';
    if (concernCount >= 2) return 'MEDIUM';
    if (recommendation.riskLevel === 'HIGH') return 'MEDIUM';
    return recommendation.riskLevel;
  }

  generateReasoning(agrees, concerns) {
    if (agrees) {
      return 'Analysis is sound. Minor concerns noted but acceptable risk level with proper testing and monitoring.';
    }

    return `${concerns.length} significant concerns identified. Additional validation required before production deployment to mitigate risks.`;
  }

  calculateConfidence(recommendation, concernCount) {
    let confidence = recommendation.confidence || 0.8;

    // Reduce confidence based on concerns
    confidence -= (concernCount * 0.05);

    // Increase confidence if well-tested
    if (recommendation.testCoverage > 85) {
      confidence += 0.05;
    }

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  // Validate that concerns were addressed
  async validateResolution(originalRecommendation, updatedRecommendation) {
    const originalConcerns = await this.critique(originalRecommendation);
    const updatedConcerns = await this.critique(updatedRecommendation);

    return {
      resolved: updatedConcerns.concerns.length < originalConcerns.concerns.length,
      improvementCount: originalConcerns.concerns.length - updatedConcerns.concerns.length,
      remainingConcerns: updatedConcerns.concerns
    };
  }
}

module.exports = SentinelAgent;
