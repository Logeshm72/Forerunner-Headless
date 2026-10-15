const jsforce = require('jsforce');
require('dotenv').config();

class SalesforceClient {
  constructor() {
    this.conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
    });
    this.isConnected = false;
    this.lastConnectTime = null;
    this.connectionTTL = 45 * 60 * 1000; // 45 minutes (Salesforce sessions expire after 2 hours by default, refresh proactively)
  }

  /**
   * Check if connection needs refresh based on time
   */
  needsRefresh() {
    if (!this.isConnected || !this.lastConnectTime) return true;
    const elapsed = Date.now() - this.lastConnectTime;
    return elapsed > this.connectionTTL;
  }

  async connect(forceRefresh = false) {
    // Allow forced reconnection to handle expired tokens
    if (this.isConnected && !forceRefresh && !this.needsRefresh()) return;

    try {
      // Try SF CLI first (best option - already authenticated)
      const cliAuth = await this.connectViaSFCLI();
      if (cliAuth) {
        this.isConnected = true;
        this.lastConnectTime = Date.now();
        console.log('✓ Connected to Salesforce via SF CLI');
        return;
      }

      // Try OAuth if credentials available
      if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET) {
        await this.connectViaOAuth();
      } else {
        // Fallback to username/password
        try {
          await this.conn.login(
            process.env.SALESFORCE_USERNAME,
            process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
          );
        } catch (loginError) {
          if (loginError.message.includes('SOAP API login() is disabled')) {
            console.log('Note: SOAP API disabled, trying OAuth...');
            await this.connectViaOAuth();
            return;
          }
          throw loginError;
        }
      }
      this.isConnected = true;
      this.lastConnectTime = Date.now();
      console.log('✓ Connected to Salesforce');
    } catch (error) {
      throw new Error(`Salesforce connection failed: ${error.message}`);
    }
  }

  async connectViaSFCLI() {
    // Try to use Salesforce CLI authenticated session
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      // Try multiple approaches to get auth
      let authInfo;

      // Approach 1: Try with environment variable if set
      if (process.env.SF_TARGET_ORG) {
        try {
          const { stdout } = await execPromise(`SF_TEMP_SHOW_SECRETS=true sf org display --target-org ${process.env.SF_TARGET_ORG} --json`);
          authInfo = JSON.parse(stdout);
        } catch (e) {
          // Continue to next approach
        }
      }

      // Approach 2: Try without specifying org (uses default)
      if (!authInfo) {
        try {
          const { stdout } = await execPromise('SF_TEMP_SHOW_SECRETS=true sf org display --json');
          authInfo = JSON.parse(stdout);
        } catch (e2) {
          // Approach 3: List orgs and use first one
          const { stdout: listStdout } = await execPromise('sf org list --json');
          const orgList = JSON.parse(listStdout);
          if (orgList.result && orgList.result.nonScratchOrgs && orgList.result.nonScratchOrgs.length > 0) {
            const firstOrg = orgList.result.nonScratchOrgs[0].username;
            const { stdout } = await execPromise(`SF_TEMP_SHOW_SECRETS=true sf org display --target-org ${firstOrg} --json`);
            authInfo = JSON.parse(stdout);
          }
        }
      }

      if (authInfo && authInfo.result && authInfo.result.accessToken) {
        // Create connection with existing access token
        // Use the org's API version or default to latest
        this.conn = new jsforce.Connection({
          instanceUrl: authInfo.result.instanceUrl,
          accessToken: authInfo.result.accessToken,
          version: authInfo.result.apiVersion || '68.0'
        });
        console.log(`✓ Using org: ${authInfo.result.username}`);
        return true;
      }
    } catch (error) {
      // SF CLI not available or org not authenticated, continue to next method
      return false;
    }
    return false;
  }

  async connectViaOAuth() {
    // OAuth 2.0 Username-Password Flow (Resource Owner Password Credentials)
    const axios = require('axios');

    // Try with password + security token first (some orgs require it)
    const password = process.env.SALESFORCE_SECURITY_TOKEN
      ? process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
      : process.env.SALESFORCE_PASSWORD;

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.SALESFORCE_CLIENT_ID);
    params.append('client_secret', process.env.SALESFORCE_CLIENT_SECRET);
    params.append('username', process.env.SALESFORCE_USERNAME);
    params.append('password', password);

    const tokenUrl = `${process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'}/services/oauth2/token`;

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Create connection with access token
      this.conn = new jsforce.Connection({
        instanceUrl: response.data.instance_url,
        accessToken: response.data.access_token
      });

      this.isConnected = true;
      this.lastConnectTime = Date.now();
      console.log('✓ Connected via OAuth 2.0');
    } catch (error) {
      const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
      throw new Error(`OAuth authentication failed: ${errorMsg}`);
    }
  }

  /**
   * Execute a Salesforce operation with automatic retry on auth failure
   */
  async withRetry(operation, retries = 1) {
    try {
      // Ensure connection is fresh
      await this.connect();
      return await operation(this.conn);
    } catch (error) {
      // Check if it's an auth error
      const isAuthError = error.message && (
        error.message.includes('INVALID_AUTH_HEADER') ||
        error.message.includes('Session expired') ||
        error.message.includes('INVALID_SESSION_ID') ||
        error.errorCode === 'INVALID_SESSION_ID'
      );

      if (isAuthError && retries > 0) {
        console.log('Session expired, reconnecting...');
        this.isConnected = false;
        await this.connect(true);
        return await operation(this.conn);
      }
      throw error;
    }
  }

  // Fetch all release updates
  async getReleaseUpdates() {
    // Force fresh connection
    this.isConnected = false;
    await this.connect();

    // Verify connection works with a simple query first
    try {
      await this.conn.query('SELECT Id FROM Organization LIMIT 1');
    } catch (testError) {
      console.warn('Connection test failed, reconnecting...');
      this.isConnected = false;
      await this.connect();
    }

    // Simplified query - just get unreleased updates to avoid date format issues
    const query = `
      SELECT Id, DurableId, Title, Description, Status, Category,
             DueDate, ReleaseDate, Release, ReleaseLabel,
             StepStage, IsReleased, HasNewSteps
      FROM ReleaseUpdate
      WHERE IsReleased = false
      ORDER BY DueDate ASC NULLS LAST
      LIMIT 200
    `;

    try {
      console.log('Querying ReleaseUpdate object via Tooling API...');

      // Try jsforce first
      let result;
      try {
        result = await this.conn.tooling.query(query);
      } catch (jsfError) {
        // If jsforce fails, try SF CLI directly
        console.log('JSforce failed, trying SF CLI directly...');
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        const cliQuery = query.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        const targetOrgParam = process.env.SF_TARGET_ORG ? `--target-org ${process.env.SF_TARGET_ORG}` : '';
        const { stdout } = await execPromise(
          `sf data query --query "${cliQuery}" --use-tooling-api ${targetOrgParam} --json`
        );

        const cliResult = JSON.parse(stdout);
        if (cliResult.status === 0 && cliResult.result) {
          result = {
            totalSize: cliResult.result.totalSize || cliResult.result.records.length,
            records: cliResult.result.records
          };
        } else {
          throw new Error('SF CLI query failed');
        }
      }

      console.log(`✅ Found ${result.totalSize} unreleased updates from Salesforce`);
      return result.records;
    } catch (error) {
      // If ReleaseUpdate is not available, return mock data
      console.error(`❌ ReleaseUpdate query failed: ${error.message}`);
      console.error(`   Error name: ${error.name}`);
      console.error(`   Error code: ${error.errorCode || 'N/A'}`);
      console.warn('Using mock release update data');
      return this.getMockReleaseUpdates();
    }
  }

  // Enable a specific release update
  async enableUpdate(updateId) {
    await this.connect();

    const result = await this.conn.tooling.sobject('ReleaseUpdate').update({
      Id: updateId,
      Status: 'Enabled'
    });
    return result;
  }

  // Disable a release update
  async disableUpdate(updateId) {
    await this.connect();

    const result = await this.conn.tooling.sobject('ReleaseUpdate').update({
      Id: updateId,
      Status: 'Disabled'
    });
    return result;
  }

  // Get org metadata (for impact analysis)
  async getMetadata() {
    await this.connect();

    try {
      const [triggers, classes, lwcs, flows] = await Promise.all([
        this.conn.tooling.query('SELECT Id, Name, Status FROM ApexTrigger LIMIT 100'),
        this.conn.tooling.query('SELECT Id, Name FROM ApexClass WHERE Status = \'Active\' LIMIT 100'),
        this.conn.tooling.query('SELECT Id, DeveloperName FROM LightningComponentBundle LIMIT 100'),
        this.conn.tooling.query('SELECT Id, MasterLabel, ProcessType FROM Flow WHERE Status = \'Active\' LIMIT 50')
      ]);

      return {
        triggers: triggers.records,
        apexClasses: classes.records,
        lwcComponents: lwcs.records,
        flows: flows.records
      };
    } catch (error) {
      console.warn('Could not fetch all metadata, using partial data');
      return {
        triggers: [],
        apexClasses: [],
        lwcComponents: [],
        flows: []
      };
    }
  }

  // Get test classes
  async getTestClasses() {
    await this.connect();

    const result = await this.conn.tooling.query(
      "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Test%' LIMIT 50"
    );

    return result.records;
  }

  // Run Apex tests
  async runTests(testClassIds) {
    await this.connect();

    // Enqueue test run
    const testRun = await this.conn.tooling.sobject('ApexTestQueueItem').create(
      testClassIds.map(id => ({ ApexClassId: id }))
    );

    return testRun;
  }

  // Get test results
  async getTestResults(testRunId) {
    await this.connect();

    const query = `
      SELECT Id, ApexClassId, TestTimestamp, Message, MethodName,
             Outcome, StackTrace
      FROM ApexTestResult
      WHERE AsyncApexJobId = '${testRunId}'
    `;

    const result = await this.conn.tooling.query(query);
    return result.records;
  }

  // Mock data for demo purposes
  getMockReleaseUpdates() {
    return [
      {
        Id: 'RU-LMS-2027-001',
        Title: 'Lightning Message Service Security Update',
        Description: 'Enhanced security context requirements for Lightning Message Service',
        Status: 'Preview',
        ReleaseVersion: 'Winter \'27',
        TargetDate: '2027-02-15',
        IsCritical: true,
        IsAutoEnabled: false
      },
      {
        Id: 'RU-TRG-2027-002',
        Title: 'Apex Trigger Execution Order Changes',
        Description: 'Changes to the order in which triggers fire',
        Status: 'Preview',
        ReleaseVersion: 'Winter \'27',
        TargetDate: '2027-03-01',
        IsCritical: true,
        IsAutoEnabled: false
      },
      {
        Id: 'RU-API-2027-003',
        Title: 'API Version 60.0 Enforcement',
        Description: 'Older API versions will be deprecated',
        Status: 'Enabled',
        ReleaseVersion: 'Winter \'27',
        TargetDate: '2027-04-01',
        IsCritical: true,
        IsAutoEnabled: true
      }
    ];
  }
}

module.exports = SalesforceClient;
