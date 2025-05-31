// Quick test to send message and observe SSE behavior
const { EventSource } = require('eventsource');

const BASE_URL = 'http://localhost:3000';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addCookie(cookieString) {
    const cookies = cookieString.split(',').map(c => c.trim());
    cookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        this.cookies.set(name, value);
      }
    });
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  getSessionToken() {
    return this.cookies.get('session');
  }
}

async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  return fetch(url, options);
}

async function login(email, password) {
  const cookieJar = new CookieJar();

  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  const loginData = await loginResponse.json();
  
  // Get session data
  const sessionResponse = await makeRequest(`${BASE_URL}/api/session`, {
    headers: { 'Cookie': cookieJar.getCookieHeader() }
  });
  const sessionData = await sessionResponse.json();

  return { cookieJar, user: loginData.user, sessionToken: sessionData.sessionToken };
}

async function testSendAndReceive() {
  console.log('🚀 Starting send and receive test...');

  // Login both users
  const sender = await login('sokol@example.com', 'mango');
  const receiver = await login('m@m', 'm');

  console.log(`✅ Sender: ${sender.user.username} (${sender.user.user_id})`);
  console.log(`✅ Receiver: ${receiver.user.username} (${receiver.user.user_id})`);

  // Start SSE connection for receiver
  console.log('\n📡 Starting SSE connection for receiver...');
  const eventSource = new EventSource(`${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(receiver.sessionToken)}`);
  
  let receivedMessage = false;

  eventSource.onopen = () => {
    console.log('✅ Receiver SSE connected');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`📨 Receiver got SSE:`, data.type);
      
      if (data.type === 'NEW_MESSAGE') {
        console.log(`📬 Received message: "${data.data.content}"`);
        receivedMessage = true;
      }
    } catch (e) {
      console.log(`📨 Raw SSE:`, event.data);
    }
  };

  // Wait for connection to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send message from sender to receiver
  const messageContent = `Test message ${Date.now()}`;
  console.log(`\n📤 Sending message: "${messageContent}"`);
  
  const messageResponse = await makeRequest(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sender.cookieJar.getCookieHeader()
    },
    body: JSON.stringify({
      receiver_id: receiver.user.user_id,
      content: messageContent
    })
  });

  if (messageResponse.ok) {
    console.log('✅ Message sent successfully');
  } else {
    console.log('❌ Message send failed:', await messageResponse.text());
  }

  // Wait for SSE message
  await new Promise(resolve => setTimeout(resolve, 3000));

  eventSource.close();

  console.log(`\n📊 Result: Receiver got message via SSE: ${receivedMessage ? '✅ YES' : '❌ NO'}`);
  
  return receivedMessage;
}

testSendAndReceive()
  .then(success => {
    console.log(success ? '\n✅ Real-time messaging working!' : '\n❌ Real-time messaging not working');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
