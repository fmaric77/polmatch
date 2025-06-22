const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconds for longer operations

// Configuration
const CONFIG = {
  TOTAL_USERS: 100,
  TOTAL_MESSAGES: 10000,
  BATCH_SIZE: 10, // Process users in batches to avoid overwhelming the server
  MESSAGE_BATCH_SIZE: 20, // Send messages in smaller batches
  DELAY_BETWEEN_BATCHES: 1000, // 1 second delay between batches
  DELAY_BETWEEN_MESSAGES: 100, // 100ms delay between message batches
  ADMIN_USER: {
    email: 'sokol@example.com',
    password: 'mango'
  }
};

class StressTestRunner {
  constructor() {
    this.users = [];
    this.adminSession = null;
    this.testGroupId = null;
    this.testChannelId = null;
    this.messagesSent = 0;
    this.errors = [];
    this.stats = {
      usersCreated: 0,
      usersJoinedGroup: 0,
      messagesSent: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null
    };
  }

  // Generate random user data
  generateUserData(index) {
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return {
      username: `testuser${index}_${randomSuffix}`,
      email: `testuser${index}_${randomSuffix}@stresstest.com`,
      password: 'StressTest123!',
      is_admin: false
    };
  }

  // Generate random message content
  generateMessageContent() {
    const messages = [
      "Hello everyone! This is a stress test message.",
      "Testing the messaging system under load 🚀",
      "Performance testing in progress...",
      "How is everyone doing today?",
      `This is message number ${this.messagesSent + 1}`,
      "Load testing the group chat functionality",
      "Multiple users sending messages simultaneously",
      "Checking server response times",
      "Database performance under stress",
      "Real-time messaging test in progress"
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Date().toISOString();
    return `${randomMessage} - ${timestamp}`;
  }

  // Login and get session cookie
  async login(credentials) {
    try {
      const response = await axios.post(`${BASE_URL}/api/login`, credentials, {
        timeout: TIMEOUT,
        withCredentials: true
      });
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find((cookie) => cookie.includes('session='));
        if (sessionCookie) {
          return sessionCookie.split(';')[0];
        }
      }
      throw new Error('No session cookie found');
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  // Create a new user via admin API
  async createUser(userData, adminSession) {
    try {
      const response = await axios.post(`${BASE_URL}/api/admin/create-user`, userData, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': adminSession,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.success === true;
    } catch (error) {
      this.errors.push(`Failed to create user ${userData.username}: ${error.message}`);
      return false;
    }
  }

  // Create test group
  async createTestGroup(adminSession) {
    try {
      const groupData = {
        name: `Stress Test Group ${Date.now()}`,
        description: 'Automated stress test group for 100 users',
        topic: 'performance-testing',
        is_private: false,
        profile_type: 'basic'
      };

      const response = await axios.post(`${BASE_URL}/api/groups/create`, groupData, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': adminSession,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.group_id) {
        console.log(`✅ Created test group: ${response.data.group_id}`);
        return response.data.group_id;
      }
      return null;
    } catch (error) {
      console.error(`❌ Failed to create test group: ${error.message}`);
      return null;
    }
  }

  // Get group channels
  async getGroupChannels(userSession, groupId) {
    try {
      const response = await axios.get(`${BASE_URL}/api/groups/${groupId}/channels?profile_type=basic`, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': userSession,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.channels && response.data.channels.length > 0) {
        return response.data.channels[0].channel_id; // Use first channel
      }
      return null;
    } catch (error) {
      console.error(`Failed to get channels: ${error.message}`);
      return null;
    }
  }

  // Join user to group
  async joinGroup(userSession, groupId) {
    try {
      const response = await axios.post(`${BASE_URL}/api/groups/join`, {
        group_id: groupId,
        profile_type: 'basic'
      }, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': userSession,
          'Content-Type': 'application/json'
        }
      });

      return response.data.success === true;
    } catch (error) {
      this.errors.push(`Failed to join group: ${error.message}`);
      return false;
    }
  }

  // Send message to group channel
  async sendGroupMessage(userSession, groupId, channelId) {
    try {
      const messageData = {
        content: this.generateMessageContent(),
        channel_id: channelId,
        profile_type: 'basic'
      };

      const response = await axios.post(`${BASE_URL}/api/groups/${groupId}/channels/${channelId}/messages`, messageData, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': userSession,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        this.messagesSent++;
        this.stats.messagesSent++;
        return true;
      }
      return false;
    } catch (error) {
      // Try alternative endpoint if the channel-specific one fails
      try {
        const messageData = {
          content: this.generateMessageContent(),
          channel_id: channelId,
          profile_type: 'basic'
        };

        const response = await axios.post(`${BASE_URL}/api/groups/${groupId}/messages`, messageData, {
          timeout: TIMEOUT,
          headers: {
            'Cookie': userSession,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          this.messagesSent++;
          this.stats.messagesSent++;
          return true;
        }
      } catch (fallbackError) {
        this.errors.push(`Failed to send message: ${error.message}`);
      }
      return false;
    }
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Phase 1: Setup admin session and create test group
  async phase1_Setup() {
    console.log('\n🔧 Phase 1: Setting up admin session and test group');
    
    try {
      // Login as admin
      console.log('📡 Logging in as admin...');
      this.adminSession = await this.login(CONFIG.ADMIN_USER);
      console.log('✅ Admin login successful');

      // Create test group
      console.log('🏗️ Creating test group...');
      this.testGroupId = await this.createTestGroup(this.adminSession);
      
      if (!this.testGroupId) {
        throw new Error('Failed to create test group');
      }

      // Get channel ID for messaging
      console.log('📡 Getting group channels...');
      this.testChannelId = await this.getGroupChannels(this.adminSession, this.testGroupId);
      
      if (!this.testChannelId) {
        console.log('⚠️ Could not get channel ID, will try to send messages without it');
      } else {
        console.log(`✅ Got channel ID: ${this.testChannelId}`);
      }

      return true;
    } catch (error) {
      console.error(`❌ Phase 1 failed: ${error.message}`);
      return false;
    }
  }

  // Phase 2: Create users in batches
  async phase2_CreateUsers() {
    console.log(`\n👥 Phase 2: Creating ${CONFIG.TOTAL_USERS} users in batches`);
    
    for (let i = 0; i < CONFIG.TOTAL_USERS; i += CONFIG.BATCH_SIZE) {
      const batchEnd = Math.min(i + CONFIG.BATCH_SIZE, CONFIG.TOTAL_USERS);
      console.log(`\n📦 Creating users batch ${Math.floor(i/CONFIG.BATCH_SIZE) + 1} (${i + 1}-${batchEnd})...`);
      
      const promises = [];
      for (let j = i; j < batchEnd; j++) {
        const userData = this.generateUserData(j + 1);
        promises.push(this.createUser(userData, this.adminSession));
        this.users.push(userData);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      this.stats.usersCreated += successful;
      
      console.log(`✅ Batch completed: ${successful}/${batchEnd - i} users created`);
      
      if (i + CONFIG.BATCH_SIZE < CONFIG.TOTAL_USERS) {
        await this.sleep(CONFIG.DELAY_BETWEEN_BATCHES);
      }
    }

    console.log(`\n📊 User Creation Summary: ${this.stats.usersCreated}/${CONFIG.TOTAL_USERS} users created successfully`);
  }

  // Phase 3: Login users and join them to the group
  async phase3_JoinUsersToGroup() {
    console.log(`\n🏟️ Phase 3: Logging in users and joining them to the group`);
    
    for (let i = 0; i < this.users.length; i += CONFIG.BATCH_SIZE) {
      const batchEnd = Math.min(i + CONFIG.BATCH_SIZE, this.users.length);
      console.log(`\n📦 Processing batch ${Math.floor(i/CONFIG.BATCH_SIZE) + 1} (${i + 1}-${batchEnd})...`);
      
      const promises = [];
      for (let j = i; j < batchEnd; j++) {
        const user = this.users[j];
        promises.push(this.loginAndJoinGroup(user));
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      this.stats.usersJoinedGroup += successful;
      
      console.log(`✅ Batch completed: ${successful}/${batchEnd - i} users joined group`);
      
      if (i + CONFIG.BATCH_SIZE < this.users.length) {
        await this.sleep(CONFIG.DELAY_BETWEEN_BATCHES);
      }
    }

    console.log(`\n📊 Group Join Summary: ${this.stats.usersJoinedGroup}/${this.users.length} users joined the group`);
  }

  // Helper method to login user and join group
  async loginAndJoinGroup(user) {
    try {
      // Login user
      const userSession = await this.login({
        email: user.email,
        password: user.password
      });

      // Add session to user object for later use
      user.session = userSession;

      // Join group
      const joined = await this.joinGroup(userSession, this.testGroupId);
      return joined;
    } catch (error) {
      this.errors.push(`Failed to login/join user ${user.username}: ${error.message}`);
      return false;
    }
  }

  // Phase 4: Send messages
  async phase4_SendMessages() {
    console.log(`\n💬 Phase 4: Sending ${CONFIG.TOTAL_MESSAGES} messages`);
    
    // Filter users with valid sessions
    const validUsers = this.users.filter(user => user.session);
    if (validUsers.length === 0) {
      console.error('❌ No users with valid sessions found');
      return;
    }

    console.log(`� ${validUsers.length} users will send messages`);

    // Use the channel ID we got earlier, or fallback to general messaging
    let channelId = this.testChannelId;
    if (!channelId) {
      console.log('⚠️ No channel ID available, will try general group messaging');
    } else {
      console.log(`� Using channel ID: ${channelId}`);
    }

    const messagesPerBatch = CONFIG.MESSAGE_BATCH_SIZE;
    const totalBatches = Math.ceil(CONFIG.TOTAL_MESSAGES / messagesPerBatch);

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchStart = batch * messagesPerBatch;
      const batchEnd = Math.min(batchStart + messagesPerBatch, CONFIG.TOTAL_MESSAGES);
      
      console.log(`\n📦 Message batch ${batch + 1}/${totalBatches} (${batchStart + 1}-${batchEnd})...`);
      
      const promises = [];
      for (let i = batchStart; i < batchEnd; i++) {
        // Round-robin through users
        const user = validUsers[i % validUsers.length];
        if (channelId) {
          promises.push(this.sendGroupMessage(user.session, this.testGroupId, channelId));
        } else {
          // Try sending without specific channel
          promises.push(this.sendGroupMessageFallback(user.session, this.testGroupId));
        }
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      
      console.log(`✅ Batch completed: ${successful}/${batchEnd - batchStart} messages sent`);
      console.log(`📊 Total messages sent so far: ${this.stats.messagesSent}/${CONFIG.TOTAL_MESSAGES}`);
      
      if (batch + 1 < totalBatches) {
        await this.sleep(CONFIG.DELAY_BETWEEN_MESSAGES);
      }
    }

    console.log(`\n📊 Message Sending Summary: ${this.stats.messagesSent}/${CONFIG.TOTAL_MESSAGES} messages sent successfully`);
  }

  // Fallback message sending without specific channel
  async sendGroupMessageFallback(userSession, groupId) {
    try {
      const messageData = {
        content: this.generateMessageContent(),
        profile_type: 'basic'
      };

      const response = await axios.post(`${BASE_URL}/api/groups/${groupId}/messages`, messageData, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': userSession,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        this.messagesSent++;
        this.stats.messagesSent++;
        return true;
      }
      return false;
    } catch (error) {
      this.errors.push(`Failed to send message (fallback): ${error.message}`);
      return false;
    }
  }

  // Generate final report
  generateReport() {
    const duration = this.stats.endTime - this.stats.startTime;
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    console.log('\n' + '='.repeat(80));
    console.log('📊 STRESS TEST FINAL REPORT');
    console.log('='.repeat(80));
    console.log(`⏱️  Total Duration: ${durationMinutes}m ${durationSeconds}s`);
    console.log(`👥 Users Created: ${this.stats.usersCreated}/${CONFIG.TOTAL_USERS} (${Math.round((this.stats.usersCreated/CONFIG.TOTAL_USERS)*100)}%)`);
    console.log(`🏟️  Users Joined Group: ${this.stats.usersJoinedGroup}/${this.stats.usersCreated} (${this.stats.usersCreated > 0 ? Math.round((this.stats.usersJoinedGroup/this.stats.usersCreated)*100) : 0}%)`);
    console.log(`💬 Messages Sent: ${this.stats.messagesSent}/${CONFIG.TOTAL_MESSAGES} (${Math.round((this.stats.messagesSent/CONFIG.TOTAL_MESSAGES)*100)}%)`);
    console.log(`❌ Total Errors: ${this.errors.length}`);
    
    if (this.stats.messagesSent > 0 && duration > 0) {
      const messagesPerSecond = Math.round((this.stats.messagesSent * 1000) / duration);
      console.log(`🚀 Messages per second: ${messagesPerSecond}`);
    }

    if (this.errors.length > 0 && this.errors.length <= 20) {
      console.log('\n🚨 Error Summary (First 20):');
      const errorCounts = {};
      this.errors.slice(0, 20).forEach(error => {
        const key = error.split(':')[0];
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   • ${error}: ${count} occurrences`);
      });
    }

    console.log('\n🎯 Performance Analysis:');
    if (this.stats.messagesSent >= CONFIG.TOTAL_MESSAGES * 0.9) {
      console.log('   • 🟢 Excellent: >90% messages delivered');
    } else if (this.stats.messagesSent >= CONFIG.TOTAL_MESSAGES * 0.7) {
      console.log('   • 🟡 Good: 70-90% messages delivered');
    } else if (this.stats.messagesSent >= CONFIG.TOTAL_MESSAGES * 0.5) {
      console.log('   • 🟠 Acceptable: 50-70% messages delivered');
    } else {
      console.log('   • 🔴 Poor: <50% messages delivered');
    }

    console.log('\n✅ Stress test completed!');
    console.log('='.repeat(80));
  }

  // Main execution method
  async run() {
    console.log('🧪 Starting 100-User Stress Test');
    console.log(`📋 Configuration:`);
    console.log(`   • Users: ${CONFIG.TOTAL_USERS}`);
    console.log(`   • Messages: ${CONFIG.TOTAL_MESSAGES}`);
    console.log(`   • Batch Size: ${CONFIG.BATCH_SIZE} users`);
    console.log(`   • Message Batch: ${CONFIG.MESSAGE_BATCH_SIZE} messages`);
    
    this.stats.startTime = Date.now();

    try {
      // Phase 1: Setup
      const setupSuccess = await this.phase1_Setup();
      if (!setupSuccess) {
        console.error('❌ Setup failed, aborting test');
        return;
      }

      // Phase 2: Create users
      await this.phase2_CreateUsers();

      // Phase 3: Join users to group
      await this.phase3_JoinUsersToGroup();

      // Phase 4: Send messages
      await this.phase4_SendMessages();

    } catch (error) {
      console.error(`❌ Stress test failed: ${error.message}`);
    } finally {
      this.stats.endTime = Date.now();
      this.generateReport();
    }
  }
}

// Run the stress test
async function main() {
  const stressTest = new StressTestRunner();
  await stressTest.run();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stress test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

main().catch(console.error);
