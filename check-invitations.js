const { MongoClient } = require('mongodb');

async function checkInvitations() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Checking group_invitations_basic collection ===');
    const allInvitations = await db.collection('group_invitations_basic').find({}).toArray();
    console.log('Total invitations:', allInvitations.length);
    
    if (allInvitations.length > 0) {
      console.log('\nAll invitations:');
      allInvitations.forEach((inv, index) => {
        console.log(`${index + 1}. ID: ${inv.invitation_id}`);
        console.log(`   Group: ${inv.group_name} (${inv.group_id})`);
        console.log(`   Inviter: ${inv.inviter_username} (${inv.inviter_id})`);
        console.log(`   Invited: ${inv.invited_username} (${inv.invited_user_id})`);
        console.log(`   Status: ${inv.status}`);
        console.log(`   Created: ${inv.created_at}`);
        console.log(`   Profile Type: ${inv.profile_type}`);
        console.log('');
      });
    }
    
    console.log('\n=== Checking for specific user: ad9c52b9-4363-4e4c-9c05-147da6013dc2 ===');
    const userInvitations = await db.collection('group_invitations_basic').find({
      invited_user_id: 'ad9c52b9-4363-4e4c-9c05-147da6013dc2'
    }).toArray();
    
    console.log('User-specific invitations:', userInvitations.length);
    if (userInvitations.length > 0) {
      userInvitations.forEach((inv, index) => {
        console.log(`${index + 1}. Status: ${inv.status}, Group: ${inv.group_name}`);
      });
    }
    
    console.log('\n=== Checking pending invitations for user ===');
    const pendingInvitations = await db.collection('group_invitations_basic').find({
      invited_user_id: 'ad9c52b9-4363-4e4c-9c05-147da6013dc2',
      status: 'pending'
    }).toArray();
    
    console.log('Pending invitations for user:', pendingInvitations.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkInvitations(); 