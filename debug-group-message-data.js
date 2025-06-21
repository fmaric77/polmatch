#!/usr/bin/env node

const fs = require('fs');

// Read cookies from file
const cookieData = fs.readFileSync('./cookies.txt', 'utf8');
const cookie = cookieData.trim();

async function testGroupMessageData() {
    try {
        console.log('=== DEBUGGING GROUP MESSAGE DATA ===\n');
        
        // Get groups first
        const groupsResponse = await fetch('http://localhost:3000/api/groups', {
            headers: {
                'Cookie': cookie,
                'Content-Type': 'application/json'
            }
        });
        
        if (!groupsResponse.ok) {
            throw new Error(`Groups API failed: ${groupsResponse.status}`);
        }
        
        const groups = await groupsResponse.json();
        console.log('Groups found:', groups.length);
        
        // Test each group
        for (const group of groups.slice(0, 2)) { // Test first 2 groups
            console.log(`\n--- Testing Group: ${group.name} (${group.id}) ---`);
            
            // Get channels
            const channelsResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/channels`, {
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!channelsResponse.ok) {
                console.log(`Failed to get channels for group ${group.id}: ${channelsResponse.status}`);
                continue;
            }
            
            const channels = await channelsResponse.json();
            const defaultChannel = channels.find(ch => ch.is_default) || channels[0];
            
            if (!defaultChannel) {
                console.log('No channels found');
                continue;
            }
            
            console.log(`Using channel: ${defaultChannel.name} (${defaultChannel.channel_id})`);
            
            // Get messages
            const messagesResponse = await fetch(`http://localhost:3000/api/groups/${group.id}/channels/${defaultChannel.channel_id}/messages`, {
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!messagesResponse.ok) {
                console.log(`Failed to get messages: ${messagesResponse.status}`);
                continue;
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
            }
        }
        
    } catch (error) {
        console.error('Error testing group message data:', error);
    }
}

testGroupMessageData();
