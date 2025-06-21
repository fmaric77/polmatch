#!/bin/bash

# Debug script to check group messages API using curl

BASE_URL="http://localhost:3000"
LOGIN_EMAIL="sokol@example.com"
LOGIN_PASSWORD="mango"

echo "🔐 Logging in..."

# Login and get session cookie
RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"password\":\"$LOGIN_PASSWORD\"}")

echo "Login response: $RESPONSE"

# Check if cookies file was created
if [ ! -f cookies.txt ]; then
  echo "❌ No cookies file created - login may have failed"
  exit 1
fi

echo "✅ Login successful"

# Get groups list
echo "📋 Fetching groups..."
GROUPS_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/groups")
echo "Groups response: $GROUPS_RESPONSE"

# Extract first group ID (assuming JSON response)
GROUP_ID=$(echo "$GROUPS_RESPONSE" | grep -o '"group_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$GROUP_ID" ]; then
  echo "❌ No group ID found"
  exit 1
fi

echo "🎯 Testing group ID: $GROUP_ID"

# Get group messages
echo "📨 Fetching group messages..."
MESSAGES_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/groups/$GROUP_ID/messages?profile_type=basic")
echo "Messages response: $MESSAGES_RESPONSE"

# Clean up
rm -f cookies.txt

echo "✅ Test completed"
