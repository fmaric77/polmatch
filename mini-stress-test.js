const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000;

// Small test configuration
const CONFIG = {
  USERS: 5,    // Start with 5 users
  MESSAGES: 50, // Send 50 messages total
  ADMIN_USER: {
    email: 'sokol@example.com',
    password: 'mango'
  }
};

class MiniStressTest {
  constructor() {
    this.users = [];
    this.adminSession = null;
    this.testGroupId = null;
    this.testChannelId = null;
  }

  async login(credentials) {
    try {
      const response = await axios.post(`${BASE_URL}/api/login`, credentials, {
        timeout: TIMEOUT,
        withCredentials: true
      });
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find(cookie => cookie.includes('session='));
        if (sessionCookie) {
          return sessionCookie.split(';')[0];
        }
      }
      throw new Error('No session cookie found');
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async createUser(userData, adminSession) {
    try {
      const response = await axios.post(`${BASE_URL}/api/admin/create-user`, userData, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': adminSession,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Creating user ${userData.username}:`, response.data);
      return response.data.success === true;
    } catch (error) {
      console.error(`Failed to create user ${userData.username}:`, error.response?.data || error.message);
      return false;
    }
  }

  async createTestGroup(adminSession) {
    try {
      const groupData = {
        name: `Mini Test Group ${Date.now()}`,
        description: 'Small test group for functionality testing',
        topic: 'testing',
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

      console.log('Group creation response:', response.data);
      
      if (response.data.success && response.data.group_id) {
        console.log(`✅ Created test group: ${response.data.group_id}`);
        return response.data.group_id;
      }
      return null;
    } catch (error) {
      console.error('Failed to create test group:', error.response?.data || error.message);
      return null;
    }
  }

  async getGroupChannels(userSession, groupId) {
    try {
      const response = await axios.get(`${BASE_URL}/api/groups/${groupId}/channels?profile_type=basic`, {
        timeout: TIMEOUT,
        headers: {
          'Cookie': userSession,
          'Content-Type': 'application/json'
        }
      });

      console.log('Channels response:', response.data);

      if (response.data.success && response.data.channels && response.data.channels.length > 0) {
        return response.data.channels[0].channel_id;
      }
      return null;
    } catch (error) {
      console.error('Failed to get channels:', error.response?.data || error.message);
      return null;
    }
  }

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

      console.log('Join group response:', response.data);
      return response.data.success === true;
    } catch (error) {
      console.error('Failed to join group:', error.response?.data || error.message);
      return false;
    }
  }

  async sendMessage(userSession, groupId, channelId, content) {
    try {
      // Try channel-specific endpoint first
      if (channelId) {
        const response = await axios.post(`${BASE_URL}/api/groups/${groupId}/channels/${channelId}/messages`, {
          content: content,
          profile_type: 'basic'
        }, {
          timeout: TIMEOUT,
          headers: {
            'Cookie': userSession,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          return true;
        }
      }

      // Fallback to general group messages
      const response = await axios.post(`${BASE_URL}/api/groups/${groupId}/messages`, {
        content: content,
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
      console.error('Failed to send message:', error.response?.data || error.message);
      return false;
    }
  }

  async runTest() {
    console.log('🧪 Starting Mini Stress Test');
    console.log(`👥 Creating ${CONFIG.USERS} users`);
    console.log(`💬 Sending ${CONFIG.MESSAGES} messages total`);

    try {
      // Step 1: Login as admin
      console.log('\n1. Logging in as admin...');
      this.adminSession = await this.login(CONFIG.ADMIN_USER);
      console.log('✅ Admin login successful');

      // Step 2: Create test group
      console.log('\n2. Creating test group...');
      this.testGroupId = await this.createTestGroup(this.adminSession);
      if (!this.testGroupId) {
        throw new Error('Failed to create test group');
      }

      // Step 3: Get channel ID
      console.log('\n3. Getting group channels...');
      this.testChannelId = await this.getGroupChannels(this.adminSession, this.testGroupId);
      console.log(`Channel ID: ${this.testChannelId || 'None found'}`);

      // Step 4: Create test users
      console.log('\n4. Creating test users...');
      for (let i = 1; i <= CONFIG.USERS; i++) {
        const userData = {
          username: `testuser${i}_${Date.now()}`,
          email: `testuser${i}_${Date.now()}@test.com`,
          password: 'TestPass123!',
          is_admin: false
        };

        const created = await this.createUser(userData, this.adminSession);
        if (created) {
          this.users.push(userData);
          console.log(`✅ Created user: ${userData.username}`);
        } else {
          console.log(`❌ Failed to create user: ${userData.username}`);
        }
      }

      console.log(`\n📊 Created ${this.users.length}/${CONFIG.USERS} users`);

      // Step 5: Login users and join group
      console.log('\n5. Logging in users and joining group...');
      for (const user of this.users) {
        try {
          user.session = await this.login({
            email: user.email,
            password: user.password
          });
          console.log(`✅ Logged in: ${user.username}`);

          const joined = await this.joinGroup(user.session, this.testGroupId);
          console.log(`${joined ? '✅' : '❌'} Join group: ${user.username}`);
        } catch (error) {
          console.log(`❌ Failed to login/join: ${user.username} - ${error.message}`);
        }
      }

      // Step 6: Send messages
      console.log('\n6. Sending messages...');
      const validUsers = this.users.filter(user => user.session);
      console.log(`👥 ${validUsers.length} users available for messaging`);

      let messagesSent = 0;
      for (let i = 0; i < CONFIG.MESSAGES; i++) {
        const user = validUsers[i % validUsers.length];
        const content = `Test message ${i + 1} from ${user.username} at ${new Date().toISOString()}`;
        
        const sent = await this.sendMessage(user.session, this.testGroupId, this.testChannelId, content);
        if (sent) {
          messagesSent++;
          console.log(`✅ Message ${i + 1} sent by ${user.username}`);
        } else {
          console.log(`❌ Message ${i + 1} failed from ${user.username}`);
        }
      }

      console.log('\n📊 Final Results:');
      console.log(`   • Users created: ${this.users.length}/${CONFIG.USERS}`);
      console.log(`   • Users logged in: ${validUsers.length}/${this.users.length}`);
      console.log(`   • Messages sent: ${messagesSent}/${CONFIG.MESSAGES}`);
      console.log(`   • Success rate: ${Math.round((messagesSent/CONFIG.MESSAGES)*100)}%`);

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
  }
}

// Run the test
async function main() {
  const test = new MiniStressTest();
  await test.runTest();
}

main().catch(console.error);
