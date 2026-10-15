#!/bin/bash

echo "🔍 Forerunner Headless - Setup Verification"
echo "==========================================="
echo ""

# Check Node.js
echo "Checking Node.js:"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✅ Node.js installed: $NODE_VERSION"

    # Check if version is 18+
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "  ✅ Version 18+ detected"
    else
        echo "  ⚠️  Node.js 18+ recommended (you have v$NODE_MAJOR)"
    fi
else
    echo "  ❌ Node.js not found (install from https://nodejs.org)"
fi
echo ""

# Check npm dependencies
echo "Checking dependencies:"
if [ -d "node_modules" ]; then
    echo "  ✅ node_modules exists"
else
    echo "  ⚠️  node_modules not found - run: npm install"
fi
echo ""

# Check Salesforce CLI
echo "Checking Salesforce CLI:"
if command -v sf &> /dev/null; then
    SF_VERSION=$(sf --version | head -1)
    echo "  ✅ Salesforce CLI installed: $SF_VERSION"
else
    echo "  ⚠️  Salesforce CLI not found (optional, but recommended)"
    echo "     Install: npm install -g @salesforce/cli"
fi
echo ""

# Check Agentia CLI
echo "Checking Agentia CLI:"
if command -v agentia &> /dev/null; then
    echo "  ✅ Agentia CLI installed"
else
    echo "  ⚠️  Agentia CLI not found (optional)"
    echo "     Install: npm install -g @salesforce/agentia-cli"
fi
echo ""

# Check credentials
echo "Checking credentials:"
MISSING_CREDS=""

echo -n "  SF_USERNAME... "
if [ -n "$SF_USERNAME" ] || [ -n "$SALESFORCE_USERNAME" ]; then
    echo "✅ Set"
else
    echo "⚠️  Not set"
    MISSING_CREDS="${MISSING_CREDS}SF_USERNAME "
fi

echo -n "  AGENTIA_WORKSPACE... "
if [ -n "$AGENTIA_WORKSPACE" ] || [ -n "$AGENTIA_AI_WORKSPACE" ]; then
    echo "✅ Set"
else
    echo "⚠️  Not set"
    MISSING_CREDS="${MISSING_CREDS}AGENTIA_WORKSPACE "
fi

echo -n "  COPADO_API_KEY... "
if [ -n "$COPADO_API_KEY" ]; then
    echo "✅ Set"
else
    echo "⚠️  Not set"
    MISSING_CREDS="${MISSING_CREDS}COPADO_API_KEY "
fi

echo ""

# Summary
if [ -z "$MISSING_CREDS" ]; then
    echo "✅ All checks passed! Ready to use Forerunner Headless."
else
    echo "⚠️  Missing $MISSING_CREDS credential(s). Set environment variables:"
    echo ""
    if [ -z "$SF_USERNAME" ] && [ -z "$SALESFORCE_USERNAME" ]; then
        echo "  export SF_USERNAME=your.email@company.com"
    fi
    if [ -z "$AGENTIA_WORKSPACE" ] && [ -z "$AGENTIA_AI_WORKSPACE" ]; then
        echo "  export AGENTIA_WORKSPACE=your-workspace-id"
    fi
    if [ -z "$COPADO_API_KEY" ]; then
        echo "  export COPADO_API_KEY=your-api-key"
    fi
    echo ""
    echo "For production use, set credentials:"
    echo "  Add exports to ~/.zshrc or ~/.bashrc"
    echo ""
    echo "For testing, demo mode is available (uses mock data)."
fi

echo ""
echo "Next steps:"
echo "  1. npm install (if dependencies not installed)"
echo "  2. Set environment variables (see above)"
echo "  3. ./forerunner-headless help"
echo ""
