const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 30000;

// Extreme stress test configuration
const CONFIG = {
  TOTAL_USERS: 500,
  TOTAL_MESSAGES: 50000,
  CONCURRENT_GROUPS: 10,
  BATCH_SIZE: 25,
  MESSAGE_BATCH_SIZE: 50,
  ADMIN_USER: {
    email: 'sokol@example.com',
    password: 'mango'
  }
};

class ExtremeStressTestRunner {
  constructor() {
    this.users = [];
    this.groups = [];
    this.adminSession = null;
    this.stats = {
      usersCreated: 0,
      groupsCreated: 0,
      usersJoinedGroups: 0,
      messagesSent: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null,
      phases: []
    };
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  generateUserData(index) {
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return {
      username: `extremeuser${index}_${randomSuffix}`,
      email: `extremeuser${index}_${randomSuffix}@stresstest.com`,
      password: 'ExtremeTest123!',
      is_admin: false
    };
  }

  generateMessageContent(userIndex, messageNumber) {
    const messages = [
      `🔥 EXTREME MSG #${messageNumber} from user ${userIndex}`,
      `💪 Testing system limits! User ${userIndex}, Message ${messageNumber}`,
      `🚀 High-volume stress test in progress... ${userIndex}:${messageNumber}`,
      `⚡ Pushing boundaries with message ${messageNumber} from ${userIndex}`,
      `🎯 Performance validation: User ${userIndex} sending message ${messageNumber}`
    ];
    return messages[messageNumber % messages.length];
  }

  async loginAdmin() {
    this.log('🔐 Logging in as admin...');
    try {
      const response = await axios.post(`${BASE_URL}/api/login`, CONFIG.ADMIN_USER, {
        timeout: TIMEOUT,
        withCredentials: true
      });

      if (response.data.success) {
        const cookies = response.headers['set-cookie'];
        const sessionCookie = cookies?.find(cookie => cookie.includes('session='));
        if (sessionCookie) {
          this.adminSession = sessionCookie.split(';')[0];
          this.log('✅ Admin login successful');
          return this.adminSession;
        }
      }
      throw new Error('Failed to get session cookie');
    } catch (error) {
      throw new Error(`Admin login failed: ${error.message}`);
    }
  }

  async createTestGroups() {
    this.log(`🏗️  Creating ${CONFIG.CONCURRENT_GROUPS} test groups...`);
    const groupPromises = [];
    
    for (let i = 0; i < CONFIG.CONCURRENT_GROUPS; i++) {
      const groupName = `ExtremeStressGroup_${i + 1}_${Date.now()}`;
      const groupPromise = this.createSingleGroup(groupName, i + 1);
      groupPromises.push(groupPromise);
    }

    const results = await Promise.allSettled(groupPromises);
    const successfulGroups = results.filter(r => r.status === 'fulfilled').length;
    
    this.stats.groupsCreated = this.groups.length;
    this.log(`📊 Created ${successfulGroups}/${CONFIG.CONCURRENT_GROUPS} groups`);
  }

  async createSingleGroup(groupName, groupNumber) {
    try {
      const response = await axios.post(`${BASE_URL}/api/groups/create`, {
        name: groupName,
        description: `Extreme stress test group ${groupNumber}`,
        profile_type: 'basic'
      }, {
        timeout: TIMEOUT,
        headers: { 'Cookie': this.adminSession }
      });

      if (response.data.success) {
        const group = {
          id: response.data.group_id,
          name: groupName,
          channelId: response.data.default_channel_id,
          members: []
        };
        this.groups.push(group);
        this.log(`✅ Created group ${groupNumber}: ${group.id}`);
        return group;
      } else {
        throw new Error(`Group creation failed: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.log(`❌ Failed to create group ${groupNumber}: ${error.message}`);
      this.stats.totalErrors++;
      throw error;
    }
  }

  async createUsers() {
    this.log(`👥 Creating ${CONFIG.TOTAL_USERS} users in batches of ${CONFIG.BATCH_SIZE}...`);
    
    for (let batch = 0; batch < Math.ceil(CONFIG.TOTAL_USERS / CONFIG.BATCH_SIZE); batch++) {
      const batchStart = batch * CONFIG.BATCH_SIZE;
      const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, CONFIG.TOTAL_USERS);
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const userData = this.generateUserData(i + 1);
        userData.assignedGroupIndex = i % this.groups.length; // Distribute users across groups
        const userPromise = this.createSingleUser(userData, i + 1);
        batchPromises.push(userPromise);
      }
      
      const results = await Promise.allSettled(batchPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      this.log(`✅ Batch ${batch + 1}: ${successCount}/${batchEnd - batchStart} users created`);
      
      // Brief pause between batches
      if (batch < Math.ceil(CONFIG.TOTAL_USERS / CONFIG.BATCH_SIZE) - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    this.stats.usersCreated = this.users.length;
    this.log(`📊 Created ${this.users.length}/${CONFIG.TOTAL_USERS} users`);
  }

  async createSingleUser(userData, userNumber) {
    try {
      const response = await axios.post(`${BASE_URL}/api/admin/create-user`, userData, {
        timeout: TIMEOUT,
        headers: { 'Cookie': this.adminSession }
      });

      if (response.data.success) {
        this.users.push(userData);
        return userData;
      } else {
        throw new Error(`User creation failed: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.log(`❌ Failed to create user ${userNumber}: ${error.message}`);
      this.stats.totalErrors++;
      throw error;
    }
  }

  async loginAndJoinUsersToGroups() {
    this.log(`🔑 Logging in ${this.users.length} users and joining groups...`);
    
    for (let batch = 0; batch < Math.ceil(this.users.length / CONFIG.BATCH_SIZE); batch++) {
      const batchStart = batch * CONFIG.BATCH_SIZE;
      const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, this.users.length);
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const user = this.users[i];
        const loginPromise = this.loginUserAndJoinGroup(user);
        batchPromises.push(loginPromise);
      }
      
      const results = await Promise.allSettled(batchPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      this.log(`✅ Batch ${batch + 1}: ${successCount}/${batchEnd - batchStart} users logged in and joined groups`);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const loggedInUsers = this.users.filter(u => u.sessionCookie).length;
    this.stats.usersJoinedGroups = loggedInUsers;
    this.log(`📊 ${loggedInUsers}/${this.users.length} users ready for messaging`);
  }

  async loginUserAndJoinGroup(user) {
    try {
      // Login user
      const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
        email: user.email,
        password: user.password
      }, {
        timeout: TIMEOUT,
        withCredentials: true
      });

      if (!loginResponse.data.success) {
        throw new Error(`Login failed for ${user.username}`);
      }

      const cookies = loginResponse.headers['set-cookie'];
      const sessionCookie = cookies?.find(cookie => cookie.includes('session='));
      if (!sessionCookie) {
        throw new Error(`No session cookie for ${user.username}`);
      }

      user.sessionCookie = sessionCookie.split(';')[0];

      // Join assigned group
      const group = this.groups[user.assignedGroupIndex];
      const joinResponse = await axios.post(`${BASE_URL}/api/groups/join`, {
        group_id: group.id,
        profile_type: 'basic'
      }, {
        timeout: TIMEOUT,
        headers: { 'Cookie': user.sessionCookie }
      });

      if (!joinResponse.data.success) {
        throw new Error(`Group join failed for ${user.username}`);
      }

      group.members.push(user);
      return true;
    } catch (error) {
      this.log(`❌ Failed to login/join user ${user.username}: ${error.message}`);
      this.stats.totalErrors++;
      throw error;
    }
  }

  async sendExtremeMessages() {
    this.log(`🚀 Starting extreme message sending: ${CONFIG.TOTAL_MESSAGES} messages across ${this.groups.length} groups`);
    
    const availableUsers = this.users.filter(u => u.sessionCookie);
    if (availableUsers.length === 0) {
      throw new Error('No users available for messaging');
    }

    let messagesSent = 0;
    const totalBatches = Math.ceil(CONFIG.TOTAL_MESSAGES / CONFIG.MESSAGE_BATCH_SIZE);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const batchStart = batch * CONFIG.MESSAGE_BATCH_SIZE;
      const batchEnd = Math.min(batchStart + CONFIG.MESSAGE_BATCH_SIZE, CONFIG.TOTAL_MESSAGES);
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const user = availableUsers[i % availableUsers.length];
        const group = this.groups[user.assignedGroupIndex];
        const content = this.generateMessageContent(user.username, i + 1);
        
        const messagePromise = this.sendSingleMessage(user, group, content);
        batchPromises.push(messagePromise);
      }
      
      const results = await Promise.allSettled(batchPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      messagesSent += successCount;
      
      if (batch % 10 === 0 || batch === totalBatches - 1) {
        this.log(`📈 Progress: ${messagesSent}/${CONFIG.TOTAL_MESSAGES} messages sent (${((messagesSent/CONFIG.TOTAL_MESSAGES)*100).toFixed(1)}%)`);
      }
      
      // Brief pause between message batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.stats.messagesSent = messagesSent;
    this.log(`📊 Sent ${messagesSent}/${CONFIG.TOTAL_MESSAGES} messages`);
  }

  async sendSingleMessage(user, group, content) {
    try {
      const response = await axios.post(`${BASE_URL}/api/groups/${group.id}/messages`, {
        channel_id: group.channelId,
        content: content,
        profile_type: 'basic'
      }, {
        timeout: TIMEOUT,
        headers: { 'Cookie': user.sessionCookie }
      });

      if (response.data.success) {
        return true;
      } else {
        throw new Error(`Message send failed: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.stats.totalErrors++;
      throw error;
    }
  }

  generateReport() {
    const duration = this.stats.endTime - this.stats.startTime;
    const durationMinutes = (duration / 1000 / 60).toFixed(2);
    const throughput = this.stats.messagesSent / (duration / 1000);
    const successRate = ((CONFIG.TOTAL_USERS - this.stats.totalErrors) / CONFIG.TOTAL_USERS * 100);

    console.log('\n' + '='.repeat(80));
    console.log('🏁 EXTREME STRESS TEST COMPLETE');
    console.log('='.repeat(80));
    
    console.log('\n📊 CONFIGURATION:');
    console.log(`   • Target Users: ${CONFIG.TOTAL_USERS}`);
    console.log(`   • Target Messages: ${CONFIG.TOTAL_MESSAGES}`);
    console.log(`   • Target Groups: ${CONFIG.CONCURRENT_GROUPS}`);
    console.log(`   • Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`   • Message Batch Size: ${CONFIG.MESSAGE_BATCH_SIZE}`);
    
    console.log('\n📈 RESULTS:');
    console.log(`   • Users Created: ${this.stats.usersCreated}/${CONFIG.TOTAL_USERS}`);
    console.log(`   • Groups Created: ${this.stats.groupsCreated}/${CONFIG.CONCURRENT_GROUPS}`);
    console.log(`   • Users Joined Groups: ${this.stats.usersJoinedGroups}/${CONFIG.TOTAL_USERS}`);
    console.log(`   • Messages Sent: ${this.stats.messagesSent}/${CONFIG.TOTAL_MESSAGES}`);
    console.log(`   • Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`   • Total Duration: ${durationMinutes} minutes`);
    console.log(`   • Message Throughput: ${throughput.toFixed(2)} messages/sec`);
    console.log(`   • Total Errors: ${this.stats.totalErrors}`);
    
    console.log('\n🎯 SYSTEM ASSESSMENT:');
    if (successRate >= 99 && throughput >= 15) {
      console.log('   🟢 EXCELLENT - System handled extreme load with minimal issues');
    } else if (successRate >= 95 && throughput >= 10) {
      console.log('   🟡 GOOD - System performed well under extreme stress');
    } else if (successRate >= 90) {
      console.log('   🟠 ACCEPTABLE - System struggled but maintained functionality');
    } else {
      console.log('   🔴 POOR - System had significant issues under extreme load');
    }

    // Save detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      stats: this.stats,
      assessment: {
        successRate,
        throughput,
        duration: durationMinutes
      }
    };
    
    const fs = require('fs');
    fs.writeFileSync(`extreme-stress-report-${Date.now()}.json`, JSON.stringify(reportData, null, 2));
    console.log('\n💾 Detailed report saved to extreme-stress-report-*.json');
  }

  async run() {
    try {
      this.log('🚀 STARTING EXTREME STRESS TEST');
      this.log(`📋 Config: ${CONFIG.TOTAL_USERS} users, ${CONFIG.TOTAL_MESSAGES} messages, ${CONFIG.CONCURRENT_GROUPS} groups`);
      this.stats.startTime = Date.now();
      
      await this.loginAdmin();
      await this.createTestGroups();
      await this.createUsers();
      await this.loginAndJoinUsersToGroups();
      await this.sendExtremeMessages();
      
      this.stats.endTime = Date.now();
      this.generateReport();
      
    } catch (error) {
      this.log(`💥 CRITICAL FAILURE: ${error.message}`);
      this.stats.endTime = Date.now();
      this.generateReport();
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(0);
});

// Start the extreme stress test
const testRunner = new ExtremeStressTestRunner();
testRunner.run();
