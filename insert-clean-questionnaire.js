const { MongoClient } = require('mongodb');
const fs = require('fs');

// MongoDB connection configuration
const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const DATABASE_NAME = 'polmatch';

async function insertCleanQuestionnaire() {
    let client = null;
    
    try {
        console.log('📖 Reading clean questionnaire JSON file...');
        
        // Read the JSON file
        const jsonData = fs.readFileSync('/home/filip/Desktop/pol/clean-questionnaire.json', 'utf8');
        const questionnaireArray = JSON.parse(jsonData);
        
        if (!Array.isArray(questionnaireArray) || questionnaireArray.length === 0) {
            throw new Error('Invalid questionnaire data format');
        }
        
        const questionnaireData = questionnaireArray[0]; // Get the first (and only) questionnaire
        
        console.log(`📋 Found questionnaire: ${questionnaireData.name}`);
        console.log(`📝 Total questions: ${questionnaireData.questions.length}`);
        
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Create collections references
        const questionnaireGroupsCollection = db.collection('questionnaire_groups');
        const questionnairesCollection = db.collection('questionnaires');
        const questionsCollection = db.collection('questions');
        const metadataCollection = db.collection('questionnaire_metadata');
        
        console.log('🗑️ Clearing existing questionnaire data...');
        // Clear existing data
        await questionnaireGroupsCollection.deleteMany({});
        await questionnairesCollection.deleteMany({});
        await questionsCollection.deleteMany({});
        await metadataCollection.deleteMany({});
        
        // Create metadata
        const metadata = {
            name: 'Basic Profile Questionnaire System',
            description: 'Complete questionnaire system for basic profile matching',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            totalGroups: 1,
            totalQuestionnaires: 1,
            totalQuestions: questionnaireData.questions.length,
            profileType: 'basic',
            updatedAt: new Date().toISOString()
        };
        
        console.log('💾 Saving metadata...');
        await metadataCollection.insertOne(metadata);
        
        // Create questionnaire group
        const groupId = 'basic_profile_group';
        const groupDoc = {
            _id: groupId,
            id: groupId,
            name: 'Basic Profile Questions',
            description: 'Core questions for basic profile matching and compatibility',
            order: 1,
            category: 'basic',
            profileType: 'basic',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        console.log('📁 Saving questionnaire group...');
        await questionnaireGroupsCollection.insertOne(groupDoc);
        
        // Create questionnaire
        const questionnaireId = questionnaireData.id || 'basic_profile_questionnaire';
        const questionnaireDoc = {
            _id: questionnaireId,
            id: questionnaireId,
            groupId: groupId,
            name: questionnaireData.name || 'Basic Profile Questionnaire',
            description: questionnaireData.description || 'Comprehensive questionnaire for basic profile information',
            order: 1,
            questionCount: questionnaireData.questions.length,
            profileType: 'basic',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        console.log('📋 Saving questionnaire...');
        await questionnairesCollection.insertOne(questionnaireDoc);
        
        // Process and save questions
        console.log('❓ Saving questions...');
        const questionDocs = questionnaireData.questions.map((question, index) => {
            // Map question types to expected format
            let questionType = question.type;
            switch (question.type) {
                case 'multiple_choice':
                    questionType = 'multiple_choice';
                    break;
                case 'textarea':
                    questionType = 'text_area';
                    break;
                case 'text_input':
                    questionType = 'text_input';
                    break;
                case 'number':
                    questionType = 'number_input';
                    break;
                case 'text_tags':
                    questionType = 'text_tags';
                    break;
                default:
                    questionType = 'multiple_choice'; // Default fallback
            }
            
            return {
                _id: question.id,
                id: question.id,
                questionnaireId: questionnaireId,
                groupId: groupId,
                text: question.text,
                type: questionType,
                required: question.required,
                options: question.options || [],
                category: 'basic_profile', // All questions are basic profile type
                order: index + 1,
                profileType: 'basic',
                inputType: questionType === 'text_input' ? 'text' : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        });
        
        // Insert questions in batches to avoid memory issues
        const batchSize = 100;
        for (let i = 0; i < questionDocs.length; i += batchSize) {
            const batch = questionDocs.slice(i, i + batchSize);
            await questionsCollection.insertMany(batch);
            console.log(`   📝 Saved questions ${i + 1}-${Math.min(i + batchSize, questionDocs.length)} of ${questionDocs.length}`);
        }
        
        // Create indexes for better performance
        console.log('🔍 Creating database indexes...');
        
        // Indexes for questionnaire_groups
        await questionnaireGroupsCollection.createIndex({ order: 1 });
        await questionnaireGroupsCollection.createIndex({ profileType: 1 });
        
        // Indexes for questionnaires
        await questionnairesCollection.createIndex({ groupId: 1 });
        await questionnairesCollection.createIndex({ order: 1 });
        await questionnairesCollection.createIndex({ groupId: 1, order: 1 });
        await questionnairesCollection.createIndex({ profileType: 1 });
        
        // Indexes for questions
        await questionsCollection.createIndex({ questionnaireId: 1 });
        await questionsCollection.createIndex({ groupId: 1 });
        await questionsCollection.createIndex({ order: 1 });
        await questionsCollection.createIndex({ questionnaireId: 1, order: 1 });
        await questionsCollection.createIndex({ type: 1 });
        await questionsCollection.createIndex({ required: 1 });
        await questionsCollection.createIndex({ profileType: 1 });
        await questionsCollection.createIndex({ category: 1 });
        
        // Display summary
        console.log('\n✅ Clean questionnaire data successfully inserted into MongoDB!');
        console.log('\n📊 Summary:');
        console.log(`📁 Groups: ${metadata.totalGroups}`);
        console.log(`📋 Questionnaires: ${metadata.totalQuestionnaires}`);
        console.log(`❓ Questions: ${metadata.totalQuestions}`);
        console.log(`🏷️  Profile Type: ${metadata.profileType}`);
        
        // Display collection counts
        const groupCount = await questionnaireGroupsCollection.countDocuments();
        const questionnaireCount = await questionnairesCollection.countDocuments();
        const questionCount = await questionsCollection.countDocuments();
        
        console.log('\n🗄️ Database Collections:');
        console.log(`  questionnaire_groups: ${groupCount} documents`);
        console.log(`  questionnaires: ${questionnaireCount} documents`);
        console.log(`  questions: ${questionCount} documents`);
        
        // Display sample data structure
        console.log('\n🔍 Sample Question Structure:');
        const sampleQuestion = await questionsCollection.findOne();
        if (sampleQuestion) {
            console.log(JSON.stringify({
                id: sampleQuestion.id,
                text: sampleQuestion.text.substring(0, 50) + '...',
                type: sampleQuestion.type,
                required: sampleQuestion.required,
                optionsCount: sampleQuestion.options?.length || 0,
                profileType: sampleQuestion.profileType,
                category: sampleQuestion.category
            }, null, 2));
        }
        
        console.log('\n🎯 All questions are marked as "basic" profile type as requested!');
        
    } catch (error) {
        console.error('❌ Error inserting questionnaire data:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 MongoDB connection closed');
        }
    }
}

// Helper function to validate the inserted data
async function validateInsertedData() {
    let client = null;
    
    try {
        console.log('\n🔍 Validating inserted data...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Check that all questions have profileType: 'basic'
        const questionsWithoutBasicProfile = await db.collection('questions')
            .countDocuments({ profileType: { $ne: 'basic' } });
        
        if (questionsWithoutBasicProfile === 0) {
            console.log('✅ All questions correctly marked as "basic" profile type');
        } else {
            console.log(`❌ Found ${questionsWithoutBasicProfile} questions without "basic" profile type`);
        }
        
        // Check question types distribution
        const questionTypes = await db.collection('questions').aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        console.log('\n📊 Question Types Distribution:');
        questionTypes.forEach(type => {
            console.log(`  ${type._id}: ${type.count} questions`);
        });
        
        // Check for questions with options
        const questionsWithOptions = await db.collection('questions')
            .countDocuments({ 'options.0': { $exists: true } });
        
        const questionsWithoutOptions = await db.collection('questions')
            .countDocuments({ 'options.0': { $exists: false } });
        
        console.log(`\n📝 Questions with options: ${questionsWithOptions}`);
        console.log(`📝 Questions without options: ${questionsWithoutOptions}`);
        
    } catch (error) {
        console.error('❌ Error validating data:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the script
if (require.main === module) {
    insertCleanQuestionnaire()
        .then(() => validateInsertedData())
        .then(() => {
            console.log('\n🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = {
    insertCleanQuestionnaire,
    validateInsertedData
};
