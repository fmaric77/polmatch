const { MongoClient } = require('mongodb');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://sokolfilipdev:polmatchdbpass@cluster0.e5h3y.mongodb.net/';
const DATABASE_NAME = 'polmatch';

async function verifyInsertion() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Check questionnaire groups
        const groups = await db.collection('questionnaire_groups').find({}).toArray();
        console.log('📁 Questionnaire Groups:', groups.length);
        if (groups.length > 0) {
            console.log('   Group:', groups[0].name);
            console.log('   Profile Type:', groups[0].profileType);
        }
        
        // Check questionnaires
        const questionnaires = await db.collection('questionnaires').find({}).toArray();
        console.log('📋 Questionnaires:', questionnaires.length);
        if (questionnaires.length > 0) {
            console.log('   Questionnaire:', questionnaires[0].name);
            console.log('   Profile Type:', questionnaires[0].profileType);
            console.log('   Question Count:', questionnaires[0].questionCount);
        }
        
        // Check questions
        const questionCount = await db.collection('questions').countDocuments({});
        console.log('❓ Total Questions:', questionCount);
        
        // Check profile types
        const basicQuestions = await db.collection('questions').countDocuments({ profileType: 'basic' });
        console.log('🏷️  Basic Profile Questions:', basicQuestions);
        
        // Sample question
        const sampleQuestion = await db.collection('questions').findOne({});
        if (sampleQuestion) {
            console.log('\n📝 Sample Question:');
            console.log('   ID:', sampleQuestion.id);
            console.log('   Text:', sampleQuestion.text.substring(0, 60) + '...');
            console.log('   Type:', sampleQuestion.type);
            console.log('   Profile Type:', sampleQuestion.profileType);
            console.log('   Required:', sampleQuestion.required);
            if (sampleQuestion.options) {
                console.log('   Options:', sampleQuestion.options.length);
            }
        }
        
        console.log('\n✅ Verification complete!');
        
    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await client.close();
        console.log('🔌 MongoDB connection closed');
    }
}

verifyInsertion();
