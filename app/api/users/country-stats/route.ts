import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';

const client = new MongoClient(MONGODB_URI);

// Cache for IP lookups to avoid repeated API calls
const ipLocationCache = new Map<string, string>();

// Function to get country from IP using a free geolocation service
async function getCountryFromIP(ip: string): Promise<string> {
  // Check cache first
  if (ipLocationCache.has(ip)) {
    return ipLocationCache.get(ip)!;
  }
  
  // Handle localhost and private IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown' || 
      ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    ipLocationCache.set(ip, 'Unknown');
    return 'Unknown';
  }
  
  try {
    console.log(`Looking up country for IP: ${ip}`);
    
    // Using ip-api.com (free service, 1000 requests per month)
    // Alternative free services: ipapi.co, freegeoip.app
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'success' && data.country) {
      console.log(`IP ${ip} resolved to country: ${data.country}`);
      ipLocationCache.set(ip, data.country);
      return data.country;
    } else {
      console.warn(`Failed to resolve IP ${ip}:`, data);
      ipLocationCache.set(ip, 'Unknown');
      return 'Unknown';
    }
    
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    ipLocationCache.set(ip, 'Unknown');
    return 'Unknown';
  }
}

export async function GET() {
  try {
    await client.connect();
    const db = client.db('polmatch');

    // Get all users with their IP addresses
    const users = await db.collection('users').find(
      { 
        account_status: 'active',
        ip_address: { 
          $exists: true, 
          $ne: '', 
          $nin: [null, 'unknown', '127.0.0.1', '::1'] 
        }
      },
      { 
        projection: { 
          ip_address: 1,
          registration_date: 1,
          last_login: 1
        } 
      }
    ).toArray();

    console.log(`Found ${users.length} users with IP addresses`);

    // Count users by country
    const countryStats: { [country: string]: number } = {};
    
    // Process IPs sequentially to avoid rate limiting
    for (const user of users) {
      if (user.ip_address) {
        const country = await getCountryFromIP(user.ip_address);
        countryStats[country] = (countryStats[country] || 0) + 1;
      }
    }

    console.log('Country statistics:', countryStats);

    // Format the response
    const formattedStats = Object.entries(countryStats).map(([country, count]) => ({
      country,
      count,
      percentage: users.length > 0 ? ((count / users.length) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      countryStats: formattedStats,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching country stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch country statistics',
        error: String(error) 
      },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}
