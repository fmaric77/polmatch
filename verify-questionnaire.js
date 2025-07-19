const { MongoClient } = require('mongodb');

// MongoDB connection configuration
const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const DATABASE_NAME = 'polmatch';

async function verifyQuestionnaireData() {
    let client = null;
    
    try {
        console.log('🔍 Verifying questionnaire data in MongoDB...\n');
        
        // Connect to MongoDB
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Check questionnaire groups
        console.log('📁 QUESTIONNAIRE GROUPS:');
        console.log('========================');
        const groups = await db.collection('questionnaire_groups').find({}).toArray();
        groups.forEach(group => {
            console.log(`- ID: ${group.id}`);
            console.log(`  Name: ${group.name}`);
            console.log(`  Description: ${group.description}`);
            console.log(`  Profile Type: ${group.profileType}`);
            console.log(`  Order: ${group.order}\n`);
        });
        
        // Check questionnaires
        console.log('📋 QUESTIONNAIRES:');
        console.log('==================');
        const questionnaires = await db.collection('questionnaires').find({}).toArray();
        questionnaires.forEach(questionnaire => {
            console.log(`- ID: ${questionnaire.id}`);
            console.log(`  Name: ${questionnaire.name}`);
            console.log(`  Description: ${questionnaire.description}`);
            console.log(`  Group ID: ${questionnaire.groupId}`);
            console.log(`  Profile Type: ${questionnaire.profileType}`);
            console.log(`  Question Count: ${questionnaire.questionCount}`);
            console.log(`  Order: ${questionnaire.order}\n`);
        });
        
        // Check sample questions
        console.log('❓ SAMPLE QUESTIONS (first 5):');
        console.log('==============================');
        const sampleQuestions = await db.collection('questions')
            .find({})
            .sort({ order: 1 })
            .limit(5)
            .toArray();
            
        sampleQuestions.forEach((question, index) => {
            console.log(`${index + 1}. ID: ${question.id}`);
            console.log(`   Text: ${question.text}`);
            console.log(`   Type: ${question.type}`);
            console.log(`   Required: ${question.required}`);
            console.log(`   Profile Type: ${question.profileType}`);
            console.log(`   Category: ${question.category}`);
            console.log(`   Options: ${question.options.length} options`);
            if (question.options.length > 0) {
                console.log(`   Sample options: ${question.options.slice(0, 3).map(opt => opt.text).join(', ')}${question.options.length > 3 ? '...' : ''}`);
            }
            console.log('');
        });
        
        // Check question distribution by type
        console.log('📊 QUESTION TYPE DISTRIBUTION:');
        console.log('===============================');
        const typeDistribution = await db.collection('questions').aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        typeDistribution.forEach(type => {
            console.log(`- ${type._id}: ${type.count} questions`);
        });
        
        // Check questions that require specific validation
        console.log('\n🎯 PROFILE TYPE VERIFICATION:');
        console.log('=============================');
        const basicProfileQuestions = await db.collection('questions')
            .countDocuments({ profileType: 'basic' });
        const totalQuestions = await db.collection('questions').countDocuments();
        
        console.log(`Total questions: ${totalQuestions}`);
        console.log(`Basic profile questions: ${basicProfileQuestions}`);
        console.log(`All questions correctly marked as basic: ${basicProfileQuestions === totalQuestions ? '✅ YES' : '❌ NO'}`);
        
        // Check for questions with different categories (should all be basic_profile)
        console.log('\n📂 CATEGORY VERIFICATION:');
        console.log('=========================');
        const categoryDistribution = await db.collection('questions').aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]).toArray();
        
        categoryDistribution.forEach(category => {
            console.log(`- ${category._id}: ${category.count} questions`);
        });
        
        // Check metadata
        console.log('\n📋 METADATA:');
        console.log('============');
        const metadata = await db.collection('questionnaire_metadata').findOne();
        if (metadata) {
            console.log(`Name: ${metadata.name}`);
            console.log(`Description: ${metadata.description}`);
            console.log(`Version: ${metadata.version}`);
            console.log(`Profile Type: ${metadata.profileType}`);
            console.log(`Total Groups: ${metadata.totalGroups}`);
            console.log(`Total Questionnaires: ${metadata.totalQuestionnaires}`);
            console.log(`Total Questions: ${metadata.totalQuestions}`);
            console.log(`Created At: ${metadata.createdAt}`);
        }
        
        console.log('\n✅ Verification completed successfully!');
        
    } catch (error) {
        console.error('❌ Error verifying questionnaire data:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 MongoDB connection closed');
        }
    }
}

// Function to get specific question by ID
async function getQuestionById(questionId) {
    let client = null;
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        const question = await db.collection('questions').findOne({ id: questionId });
        
        if (question) {
            console.log('📝 Question Details:');
            console.log(JSON.stringify(question, null, 2));
        } else {
            console.log(`❌ Question with ID "${questionId}" not found`);
        }
        
        return question;
    } catch (error) {
        console.error('❌ Error getting question:', error);
        return null;
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Function to search questions by text
async function searchQuestions(searchText) {
    let client = null;
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        const questions = await db.collection('questions')
            .find({ text: { $regex: searchText, $options: 'i' } })
            .limit(10)
            .toArray();
        
        console.log(`🔍 Found ${questions.length} questions matching "${searchText}":`);
        questions.forEach((question, index) => {
            console.log(`${index + 1}. ${question.id}: ${question.text}`);
        });
        
        return questions;
    } catch (error) {
        console.error('❌ Error searching questions:', error);
        return [];
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run verification if this script is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Default: run full verification
        verifyQuestionnaireData();
    } else if (args[0] === 'get' && args[1]) {
        // Get specific question by ID: node verify-questionnaire.js get q_1
        getQuestionById(args[1]);
    } else if (args[0] === 'search' && args[1]) {
        // Search questions: node verify-questionnaire.js search "relationship"
        searchQuestions(args[1]);
    } else {
        console.log('Usage:');
        console.log('  node verify-questionnaire.js              # Full verification');
        console.log('  node verify-questionnaire.js get <id>     # Get question by ID');
        console.log('  node verify-questionnaire.js search <term> # Search questions');
    }
}

module.exports = {
    verifyQuestionnaireData,
    getQuestionById,
    searchQuestions
};
