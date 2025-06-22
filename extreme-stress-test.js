const http = require('http');
const fs = require('fs');

// Extreme stress test configuration
const CONFIG = {
    TOTAL_USERS: 10,           // Start smaller for debugging
    TOTAL_MESSAGES: 100,      // Start smaller for debugging
    CONCURRENT_GROUPS: 2,      // Start smaller for debugging
    BATCH_SIZE: 5,             // Smaller batches
    RAPID_FIRE_DURATION: 5000, // 5 seconds of rapid-fire messaging
    MESSAGE_RATE_PER_SECOND: 20, // Target 20 messages/second during rapid-fire
    STRESS_PHASES: false,        // Disable multi-phase for now
    MEMORY_TRACKING: true,      // Track memory usage
};

const BASE_URL = 'localhost:3000';
const ADMIN_EMAIL = 'sokol@example.com';
const ADMIN_PASSWORD = 'mango';

// Test state tracking
const testState = {
    startTime: Date.now(),
    users: [],
    groups: [],
    totalMessagesSent: 0,
    errors: {
        userCreation: 0,
        login: 0,
        groupJoin: 0,
        messaging: 0,
        network: 0
    },
    performance: {
        userCreationTime: 0,
        groupJoinTime: 0,
        messagingTime: 0,
        peakMemory: 0,
        averageResponseTime: 0
    },
    phases: []
};

// Enhanced HTTP request function with retry logic
function makeRequest(options, data = null, retries = 3) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                testState.performance.averageResponseTime = 
                    (testState.performance.averageResponseTime + responseTime) / 2;
                
                try {
                    const result = body ? JSON.parse(body) : {};
                    resolve({ statusCode: res.statusCode, body: result, responseTime });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: body, responseTime });
                }
            });
        });

        req.on('error', (err) => {
            if (retries > 0) {
                console.log(`🔄 Retrying request (${retries} attempts left): ${err.message}`);
                setTimeout(() => {
                    makeRequest(options, data, retries - 1).then(resolve).catch(reject);
                }, 1000);
            } else {
                testState.errors.network++;
                reject(err);
            }
        });

        req.on('timeout', () => {
            req.destroy();
            if (retries > 0) {
                console.log(`⏰ Request timeout, retrying (${retries} attempts left)`);
                setTimeout(() => {
                    makeRequest(options, data, retries - 1).then(resolve).catch(reject);
                }, 2000);
            } else {
                testState.errors.network++;
                reject(new Error('Request timeout after retries'));
            }
        });

        req.setTimeout(30000); // 30 second timeout

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Memory tracking function
function trackMemory() {
    if (!CONFIG.MEMORY_TRACKING) return;
    
    const memUsage = process.memoryUsage();
    const currentMemory = memUsage.heapUsed / 1024 / 1024; // MB
    
    if (currentMemory > testState.performance.peakMemory) {
        testState.performance.peakMemory = currentMemory;
    }
    
    console.log(`📊 Memory: ${currentMemory.toFixed(2)}MB (Peak: ${testState.performance.peakMemory.toFixed(2)}MB)`);
}

// Admin login
async function adminLogin() {
    console.log('🔐 Logging in as admin...');
    
    const options = {
        hostname: BASE_URL.split(':')[0],
        port: BASE_URL.split(':')[1],
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };

    try {
        const response = await makeRequest(options, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        if (response.statusCode === 200 && response.body.success) {
            console.log('✅ Admin login successful');
            return response.body.session_token;
        } else {
            throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
        }
    } catch (error) {
        testState.errors.login++;
        throw new Error(`Login failed: ${error.message}`);
    }
}

// Create multiple test groups
async function createTestGroups(adminToken, count) {
    console.log(`🏗️  Creating ${count} test groups...`);
    const phaseStart = Date.now();
    
    for (let i = 0; i < count; i++) {
        const groupName = `ExtremeChatGroup_${i + 1}_${Date.now()}`;
        
        const options = {
            hostname: BASE_URL.split(':')[0],
            port: BASE_URL.split(':')[1],
            path: '/api/groups/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `session=${adminToken}`
            }
        };

        try {
            const response = await makeRequest(options, {
                name: groupName,
                description: `Extreme stress test group ${i + 1}`,
                profile_type: 'basic'
            });

            if (response.statusCode === 200 && response.body.success) {
                const group = {
                    id: response.body.group_id,
                    name: groupName,
                    channelId: response.body.default_channel_id,
                    members: []
                };
                testState.groups.push(group);
                console.log(`✅ Created group ${i + 1}/${count}: ${group.id}`);
            } else {
                throw new Error(`Group creation failed: ${JSON.stringify(response.body)}`);
            }
        } catch (error) {
            console.error(`❌ Failed to create group ${i + 1}: ${error.message}`);
            testState.errors.userCreation++;
        }
        
        // Brief pause between group creations
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const phaseTime = Date.now() - phaseStart;
    testState.phases.push({ phase: 'Group Creation', duration: phaseTime, count });
    console.log(`📊 Created ${testState.groups.length}/${count} groups in ${(phaseTime/1000).toFixed(2)}s`);
}

// Create users in parallel batches
async function createUsers(adminToken, totalUsers) {
    console.log(`👥 Creating ${totalUsers} users in batches of ${CONFIG.BATCH_SIZE}...`);
    const phaseStart = Date.now();
    
    for (let batch = 0; batch < Math.ceil(totalUsers / CONFIG.BATCH_SIZE); batch++) {
        const batchStart = batch * CONFIG.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, totalUsers);
        const batchPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
            const username = `extremeuser${i + 1}_${Date.now()}`;
            const userPromise = createUser(adminToken, username, i + 1);
            batchPromises.push(userPromise);
        }
        
        const batchResults = await Promise.allSettled(batchPromises);
        const successCount = batchResults.filter(r => r.status === 'fulfilled').length;
        
        console.log(`✅ Batch ${batch + 1}: ${successCount}/${batchEnd - batchStart} users created`);
        trackMemory();
        
        // Brief pause between batches to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const phaseTime = Date.now() - phaseStart;
    testState.performance.userCreationTime = phaseTime;
    testState.phases.push({ phase: 'User Creation', duration: phaseTime, count: testState.users.length });
    console.log(`📊 Created ${testState.users.length}/${totalUsers} users in ${(phaseTime/1000).toFixed(2)}s`);
}

// Create individual user
async function createUser(adminToken, username, userNumber) {
    const options = {
        hostname: BASE_URL.split(':')[0],
        port: BASE_URL.split(':')[1],
        path: '/api/admin/create-user',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `session=${adminToken}`
        }
    };

    try {
        const response = await makeRequest(options, {
            username: username,
            email: `${username}@stresstest.com`,
            password: 'testpass123',
            profile_type: 'basic'
        });

        if (response.statusCode === 200 && response.body.success) {
            const user = {
                username: username,
                email: `${username}@stresstest.com`,
                password: 'testpass123',
                sessionToken: null,
                assignedGroup: userNumber % testState.groups.length // Distribute users across groups
            };
            testState.users.push(user);
            return user;
        } else {
            throw new Error(`User creation failed: ${JSON.stringify(response.body)}`);
        }
    } catch (error) {
        testState.errors.userCreation++;
        throw error;
    }
}

// Login users and join groups in parallel
async function loginUsersAndJoinGroups() {
    console.log(`🔑 Logging in ${testState.users.length} users and joining groups...`);
    const phaseStart = Date.now();
    
    for (let batch = 0; batch < Math.ceil(testState.users.length / CONFIG.BATCH_SIZE); batch++) {
        const batchStart = batch * CONFIG.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, testState.users.length);
        const batchPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
            const user = testState.users[i];
            const loginPromise = loginUserAndJoinGroup(user);
            batchPromises.push(loginPromise);
        }
        
        const batchResults = await Promise.allSettled(batchPromises);
        const successCount = batchResults.filter(r => r.status === 'fulfilled').length;
        
        console.log(`✅ Batch ${batch + 1}: ${successCount}/${batchEnd - batchStart} users logged in and joined groups`);
        trackMemory();
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const phaseTime = Date.now() - phaseStart;
    testState.performance.groupJoinTime = phaseTime;
    testState.phases.push({ phase: 'Login & Group Join', duration: phaseTime, count: testState.users.length });
    
    const loggedInUsers = testState.users.filter(u => u.sessionToken).length;
    console.log(`📊 ${loggedInUsers}/${testState.users.length} users ready for messaging`);
}

// Login user and join assigned group
async function loginUserAndJoinGroup(user) {
    try {
        // Login
        const loginOptions = {
            hostname: BASE_URL.split(':')[0],
            port: BASE_URL.split(':')[1],
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const loginResponse = await makeRequest(loginOptions, {
            email: user.email,
            password: user.password
        });

        if (loginResponse.statusCode !== 200 || !loginResponse.body.success) {
            throw new Error(`Login failed for ${user.username}`);
        }

        user.sessionToken = loginResponse.body.session_token;

        // Join assigned group
        const group = testState.groups[user.assignedGroup];
        const joinOptions = {
            hostname: BASE_URL.split(':')[0],
            port: BASE_URL.split(':')[1],
            path: '/api/groups/join',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `session=${user.sessionToken}`
            }
        };

        const joinResponse = await makeRequest(joinOptions, {
            group_id: group.id
        });

        if (joinResponse.statusCode !== 200 || !joinResponse.body.success) {
            throw new Error(`Group join failed for ${user.username}`);
        }

        group.members.push(user);
        return true;
    } catch (error) {
        testState.errors.login++;
        throw error;
    }
}

// Phase 1: Steady load testing
async function phase1SteadyLoad() {
    console.log('\n🚀 PHASE 1: Steady Load Testing');
    const phaseStart = Date.now();
    const targetMessages = Math.floor(CONFIG.TOTAL_MESSAGES * 0.6); // 60% of total messages
    
    await sendMessagesInBatches(targetMessages, 'steady');
    
    const phaseTime = Date.now() - phaseStart;
    testState.phases.push({ phase: 'Steady Load', duration: phaseTime, messages: targetMessages });
}

// Phase 2: Rapid-fire burst testing
async function phase2RapidFire() {
    console.log('\n⚡ PHASE 2: Rapid-Fire Burst Testing');
    const phaseStart = Date.now();
    const endTime = phaseStart + CONFIG.RAPID_FIRE_DURATION;
    
    console.log(`🔥 Sending messages as fast as possible for ${CONFIG.RAPID_FIRE_DURATION/1000} seconds...`);
    
    let messageCount = 0;
    while (Date.now() < endTime && testState.totalMessagesSent < CONFIG.TOTAL_MESSAGES) {
        const promises = [];
        const availableUsers = testState.users.filter(u => u.sessionToken);
        
        // Send multiple messages simultaneously
        for (let i = 0; i < Math.min(CONFIG.MESSAGE_RATE_PER_SECOND / 10, availableUsers.length); i++) {
            const user = availableUsers[messageCount % availableUsers.length];
            const group = testState.groups[user.assignedGroup];
            
            if (group && group.channelId) {
                const messagePromise = sendSingleMessage(user, group, `🔥 RAPID-FIRE MSG #${messageCount + 1}`);
                promises.push(messagePromise);
                messageCount++;
            }
        }
        
        await Promise.allSettled(promises);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between bursts
        
        if (messageCount % 1000 === 0) {
            console.log(`🔥 Rapid-fire progress: ${messageCount} messages sent`);
            trackMemory();
        }
    }
    
    const phaseTime = Date.now() - phaseStart;
    const actualRate = messageCount / (phaseTime / 1000);
    testState.phases.push({ 
        phase: 'Rapid Fire', 
        duration: phaseTime, 
        messages: messageCount,
        rate: actualRate 
    });
    
    console.log(`🔥 Rapid-fire complete: ${messageCount} messages at ${actualRate.toFixed(2)} msg/sec`);
}

// Phase 3: Final cleanup messages
async function phase3Cleanup() {
    console.log('\n🧹 PHASE 3: Cleanup & Final Messages');
    const phaseStart = Date.now();
    const remainingMessages = CONFIG.TOTAL_MESSAGES - testState.totalMessagesSent;
    
    if (remainingMessages > 0) {
        await sendMessagesInBatches(remainingMessages, 'cleanup');
    }
    
    const phaseTime = Date.now() - phaseStart;
    testState.phases.push({ phase: 'Cleanup', duration: phaseTime, messages: remainingMessages });
}

// Send messages in controlled batches
async function sendMessagesInBatches(targetMessages, phase) {
    const batchSize = CONFIG.BATCH_SIZE;
    let messagesSent = 0;
    
    for (let batch = 0; batch < Math.ceil(targetMessages / batchSize); batch++) {
        const batchStart = messagesSent;
        const batchEnd = Math.min(messagesSent + batchSize, targetMessages);
        const promises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
            const availableUsers = testState.users.filter(u => u.sessionToken);
            if (availableUsers.length === 0) break;
            
            const user = availableUsers[i % availableUsers.length];
            const group = testState.groups[user.assignedGroup];
            
            if (group && group.channelId) {
                const messageContent = `${phase.toUpperCase()} MSG #${testState.totalMessagesSent + 1} from ${user.username}`;
                const messagePromise = sendSingleMessage(user, group, messageContent);
                promises.push(messagePromise);
            }
        }
        
        const results = await Promise.allSettled(promises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        messagesSent += successCount;
        
        if (batch % 10 === 0 || messagesSent >= targetMessages) {
            console.log(`📈 ${phase} progress: ${messagesSent}/${targetMessages} messages sent`);
            trackMemory();
        }
        
        // Adaptive delay based on system performance
        const delay = testState.performance.averageResponseTime > 1000 ? 200 : 50;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

// Send a single message
async function sendSingleMessage(user, group, content) {
    const options = {
        hostname: BASE_URL.split(':')[0],
        port: BASE_URL.split(':')[1],
        path: `/api/groups/${group.id}/messages`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `session=${user.sessionToken}`
        }
    };

    try {
        const response = await makeRequest(options, {
            channel_id: group.channelId,
            content: content,
            profile_type: 'basic'
        });

        if (response.statusCode === 200 && response.body.success) {
            testState.totalMessagesSent++;
            return true;
        } else {
            throw new Error(`Message send failed: ${JSON.stringify(response.body)}`);
        }
    } catch (error) {
        testState.errors.messaging++;
        throw error;
    }
}

// Generate comprehensive test report
function generateReport() {
    const totalTime = Date.now() - testState.startTime;
    const successRate = ((CONFIG.TOTAL_USERS - Object.values(testState.errors).reduce((a, b) => a + b, 0)) / CONFIG.TOTAL_USERS * 100);
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 EXTREME STRESS TEST COMPLETE');
    console.log('='.repeat(80));
    
    console.log('\n📊 CONFIGURATION:');
    console.log(`   • Target Users: ${CONFIG.TOTAL_USERS}`);
    console.log(`   • Target Messages: ${CONFIG.TOTAL_MESSAGES}`);
    console.log(`   • Groups Created: ${CONFIG.CONCURRENT_GROUPS}`);
    console.log(`   • Batch Size: ${CONFIG.BATCH_SIZE}`);
    
    console.log('\n📈 RESULTS:');
    console.log(`   • Users Created: ${testState.users.length}/${CONFIG.TOTAL_USERS}`);
    console.log(`   • Groups Created: ${testState.groups.length}/${CONFIG.CONCURRENT_GROUPS}`);
    console.log(`   • Messages Sent: ${testState.totalMessagesSent}/${CONFIG.TOTAL_MESSAGES}`);
    console.log(`   • Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`   • Total Duration: ${(totalTime/1000/60).toFixed(2)} minutes`);
    console.log(`   • Overall Throughput: ${(testState.totalMessagesSent/(totalTime/1000)).toFixed(2)} messages/sec`);
    
    console.log('\n⚡ PERFORMANCE:');
    console.log(`   • Peak Memory Usage: ${testState.performance.peakMemory.toFixed(2)}MB`);
    console.log(`   • Average Response Time: ${testState.performance.averageResponseTime.toFixed(0)}ms`);
    console.log(`   • User Creation Time: ${(testState.performance.userCreationTime/1000).toFixed(2)}s`);
    console.log(`   • Group Join Time: ${(testState.performance.groupJoinTime/1000).toFixed(2)}s`);
    
    console.log('\n🔍 PHASE BREAKDOWN:');
    testState.phases.forEach(phase => {
        const rate = phase.messages ? (phase.messages / (phase.duration / 1000)).toFixed(2) : 'N/A';
        console.log(`   • ${phase.phase}: ${(phase.duration/1000).toFixed(2)}s (${phase.messages || phase.count} items, ${rate} items/sec)`);
    });
    
    console.log('\n❌ ERRORS:');
    Object.entries(testState.errors).forEach(([type, count]) => {
        if (count > 0) {
            console.log(`   • ${type}: ${count}`);
        }
    });
    
    console.log('\n🎯 SYSTEM ASSESSMENT:');
    if (successRate >= 99 && testState.performance.averageResponseTime < 1000) {
        console.log('   🟢 EXCELLENT - System handled extreme load with minimal issues');
    } else if (successRate >= 95 && testState.performance.averageResponseTime < 2000) {
        console.log('   🟡 GOOD - System performed well under extreme stress');
    } else if (successRate >= 90) {
        console.log('   🟠 ACCEPTABLE - System struggled but maintained functionality');
    } else {
        console.log('   🔴 POOR - System had significant issues under extreme load');
    }
    
    // Save detailed report to file
    const reportData = {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        results: testState,
        summary: {
            totalTime,
            successRate,
            throughput: testState.totalMessagesSent/(totalTime/1000)
        }
    };
    
    fs.writeFileSync(`extreme-stress-test-report-${Date.now()}.json`, JSON.stringify(reportData, null, 2));
    console.log('\n💾 Detailed report saved to extreme-stress-test-report-*.json');
}

// Main execution
async function runExtremeStressTest() {
    try {
        console.log('🚀 STARTING EXTREME STRESS TEST');
        console.log(`📋 Config: ${CONFIG.TOTAL_USERS} users, ${CONFIG.TOTAL_MESSAGES} messages, ${CONFIG.CONCURRENT_GROUPS} groups`);
        console.log('='.repeat(80));
        
        // Initialize
        const adminToken = await adminLogin();
        await createTestGroups(adminToken, CONFIG.CONCURRENT_GROUPS);
        await createUsers(adminToken, CONFIG.TOTAL_USERS);
        await loginUsersAndJoinGroups();
        
        trackMemory();
        
        // Execute stress test phases
        if (CONFIG.STRESS_PHASES) {
            await phase1SteadyLoad();
            await phase2RapidFire();
            await phase3Cleanup();
        } else {
            // Simple single-phase test
            await sendMessagesInBatches(CONFIG.TOTAL_MESSAGES, 'standard');
        }
        
        generateReport();
        
    } catch (error) {
        console.error(`\n💥 CRITICAL FAILURE: ${error.message}`);
        console.log('\n📊 Partial Results:');
        generateReport();
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Test interrupted by user');
    generateReport();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error(`\n💥 Uncaught exception: ${error.message}`);
    generateReport();
    process.exit(1);
});

// Start the extreme stress test
runExtremeStressTest();
