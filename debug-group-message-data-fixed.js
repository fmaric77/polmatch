#!/usr/bin/env node

async function getSessionCookie() {
    try {
        console.log('Logging in to get session cookie...');
        
        // Login
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'sokol@example.com',
                password: 'mango'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }
        
        // Extract session cookie
        const setCookieHeader = loginResponse.headers.get('set-cookie');
        console.log('Set-Cookie header:', setCookieHeader);
        
        if (setCookieHeader) {
            // Parse the session cookie
            const cookies = setCookieHeader.split(',').map(c => c.trim());
            const sessionCookie = cookies.find(c => c.startsWith('session='));
            
            if (sessionCookie) {
                console.log('Session cookie found:', sessionCookie.split(';')[0]);
                return sessionCookie.split(';')[0]; // Just the session=value part
            }
        }
        
        throw new Error('No session cookie found');
        
    } catch (error) {
        console.error('Error getting session cookie:', error);
        return null;
    }
}

async function testGroupMessageData() {
    try {
        const sessionCookie = await getSessionCookie();
        if (!sessionCookie) {
            console.error('Failed to get session cookie');
            return;
        }
        
        console.log('\n=== DEBUGGING GROUP MESSAGE DATA ===\n');
        
        // Get groups first
        const groupsResponse = await fetch('http://localhost:3000/api/groups', {
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/json'
            }
        });
        
        if (!groupsResponse.ok) {
            throw new Error(`Groups API failed: ${groupsResponse.status}`);
        }
        
        const groups = await groupsResponse.json();
        console.log('Groups found:', groups.length);
        
        // Test first group
        if (groups.length > 0) {
            const group = groups[0];
            console.log(`\n--- Testing Group: ${group.name} (${group.id}) ---`);
            
            // Get channels
            const channelsResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/channels`, {
                headers: {
                    'Cookie': sessionCookie,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!channelsResponse.ok) {
                console.log(`Failed to get channels for group ${group.id}: ${channelsResponse.status}`);
                return;
            }
            
            const channels = await channelsResponse.json();
            const defaultChannel = channels.find(ch => ch.is_default) || channels[0];
            
            if (!defaultChannel) {
                console.log('No channels found');
                return;
            }
            
            console.log(`Using channel: ${defaultChannel.name} (${defaultChannel.channel_id})`);
            
            // Get messages
            const messagesResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/channels/${defaultChannel.channel_id}/messages`, {
                headers: {
                    'Cookie': sessionCookie,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!messagesResponse.ok) {
                console.log(`Failed to get messages: ${messagesResponse.status}`);
                const errorText = await messagesResponse.text();
                console.log('Error response:', errorText);
                return;
            }
            
            const messages = await messagesResponse.json();
            console.log(`Found ${messages.length} messages`);
            
            if (messages.length > 0) {
                console.log('\n--- Latest Message Data Structure ---');
                const latestMessage = messages[messages.length - 1];
                console.log('Raw message object:');
                console.log(JSON.stringify(latestMessage, null, 2));
                
                console.log('\n--- Display Name Analysis ---');
                console.log('sender_display_name:', latestMessage.sender_display_name);
                console.log('sender_username:', latestMessage.sender_username);
                console.log('sender_id:', latestMessage.sender_id);
                
                // Simulate what getAnonymousDisplayName would return
                const displayName = latestMessage.sender_display_name?.trim() ? 
                    latestMessage.sender_display_name.toUpperCase() :
                    latestMessage.sender_username?.trim() ?
                        latestMessage.sender_username.toUpperCase() :
                        `USER-${latestMessage.sender_id?.substring(0, 8)?.toUpperCase() || 'UNKNOWN'}`;
                        
                console.log('getAnonymousDisplayName would return:', displayName);
                
                // Also check a few more messages
                console.log('\n--- All Messages Display Name Check ---');
                messages.forEach((msg, idx) => {
                    console.log(`Message ${idx + 1}:`);
                    console.log(`  sender_display_name: "${msg.sender_display_name}"`);
                    console.log(`  sender_username: "${msg.sender_username}"`);
                    console.log(`  sender_id: "${msg.sender_id}"`);
                });
            } else {
                console.log('No messages found to analyze');
            }
        } else {
            console.log('No groups found');
        }
        
    } catch (error) {
        console.error('Error testing group message data:', error);
    }
}

testGroupMessageData();
