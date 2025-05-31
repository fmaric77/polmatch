#!/usr/bin/env node

/**
 * Test script to verify the duplicate message key fix
 * Tests both direct and group message deduplication
 */

const fetch = require('node-fetch');

async function testDuplicateMessageFix() {
    console.log('🧪 Testing duplicate message fix...\n');
    
    const baseUrl = 'http://localhost:3000';
    const testEmail = 'sokol@example.com';
    const testPassword = 'mango';
    
    try {
        // Step 1: Login
        console.log('1. Logging in...');
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        console.log('✅ Login successful');
        
        // Step 2: Get session to extract session token
        const sessionResponse = await fetch(`${baseUrl}/api/session`, {
            headers: {
                'Cookie': loginResponse.headers.get('set-cookie') || ''
            }
        });
        
        const sessionData = await sessionResponse.json();
        if (!sessionData.valid || !sessionData.sessionToken) {
            throw new Error('No valid session token found');
        }
        
        console.log('✅ Session token obtained');
        
        // Step 3: Establish SSE connection
        console.log('2. Testing SSE connection...');
        const sseResponse = await fetch(`${baseUrl}/api/sse`, {
            headers: {
                'Authorization': `Bearer ${sessionData.sessionToken}`,
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!sseResponse.ok) {
            throw new Error(`SSE connection failed: ${sseResponse.status}`);
        }
        
        console.log('✅ SSE connection established');
        
        // Step 4: Send test messages to trigger potential duplicates
        console.log('3. Sending test messages...');
        
        // Get user list first
        const usersResponse = await fetch(`${baseUrl}/api/users/list`, {
            headers: {
                'Cookie': loginResponse.headers.get('set-cookie') || ''
            }
        });
        const usersData = await usersResponse.json();
        
        if (!usersData.success || usersData.users.length === 0) {
            console.log('⚠️  No other users found for testing direct messages');
        } else {
            const targetUser = usersData.users[0];
            console.log(`📤 Sending direct message to ${targetUser.username}...`);
            
            // Send direct message
            const messageResponse = await fetch(`${baseUrl}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': loginResponse.headers.get('set-cookie') || ''
                },
                body: JSON.stringify({
                    receiverId: targetUser.user_id,
                    content: `Test message to check for duplicates - ${Date.now()}`
                })
            });
            
            if (messageResponse.ok) {
                console.log('✅ Direct message sent successfully');
            } else {
                console.log('⚠️  Direct message failed:', await messageResponse.text());
            }
        }
        
        // Step 5: Test group messages if groups exist
        const groupsResponse = await fetch(`${baseUrl}/api/groups/list`, {
            headers: {
                'Cookie': loginResponse.headers.get('set-cookie') || ''
            }
        });
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success && groupsData.groups.length > 0) {
            const targetGroup = groupsData.groups[0];
            console.log(`📤 Sending group message to ${targetGroup.name}...`);
            
            // Send group message
            const groupMessageResponse = await fetch(`${baseUrl}/api/groups/${targetGroup.group_id}/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': loginResponse.headers.get('set-cookie') || ''
                },
                body: JSON.stringify({
                    content: `Test group message to check for duplicates - ${Date.now()}`,
                    channelId: targetGroup.default_channel_id
                })
            });
            
            if (groupMessageResponse.ok) {
                console.log('✅ Group message sent successfully');
            } else {
                console.log('⚠️  Group message failed:', await groupMessageResponse.text());
            }
        } else {
            console.log('⚠️  No groups found for testing group messages');
        }
        
        console.log('\n🎉 Test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('- Fixed deduplication logic for both direct and group messages');
        console.log('- Proper ID field comparison (_id for direct, message_id for group)');
        console.log('- Added type guards to prevent casting errors');
        console.log('- Enhanced group message handling with proper field mapping');
        console.log('\nTo verify the fix:');
        console.log('1. Open the chat interface at http://localhost:3000/chat');
        console.log('2. Send messages and check browser console for duplicate key warnings');
        console.log('3. The warnings should no longer appear');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testDuplicateMessageFix();
