const { MongoClient } = require('mongodb');
const fs = require('fs');

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'polmatch';

interface QuestionOption {
    id: string;
    text: string;
    value: string;
}

interface Question {
    id: string;
    text: string;
    type: 'multiple_choice' | 'text_input' | 'text_area' | 'number_input';
    required: boolean;
    options: QuestionOption[];
    category: string | null;
    order: number;
    inputType?: string;
}

interface Questionnaire {
    id: string;
    name: string;
    description: string;
    order: number;
    questions: Question[];
}

interface QuestionnaireGroup {
    id: string;
    name: string;
    description: string;
    order: number;
    questionnaires: Questionnaire[];
}

interface QuestionnaireData {
    metadata: {
        name: string;
        description: string;
        version: string;
        createdAt: string;
        totalGroups: number;
        totalQuestions: number;
    };
    questionnaireGroups: QuestionnaireGroup[];
}

async function saveQuestionnairesToMongoDB(): Promise<void> {
    let client: MongoClient | null = null;
    
    try {
        // Read the JSON file
        console.log('📖 Reading questionnaire data from JSON file...');
        const jsonData = fs.readFileSync('/home/filip/Desktop/pol/questionnaire-data.json', 'utf8');
        const questionnaireData: QuestionnaireData = JSON.parse(jsonData);
        
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Create collections
        const questionnaireGroupsCollection = db.collection('questionnaire_groups');
        const questionnairesCollection = db.collection('questionnaires');
        const questionsCollection = db.collection('questions');
        const metadataCollection = db.collection('questionnaire_metadata');
        
        // Clear existing data (optional - uncomment if you want to replace existing data)
        console.log('🗑️ Clearing existing questionnaire data...');
        await questionnaireGroupsCollection.deleteMany({});
        await questionnairesCollection.deleteMany({});
        await questionsCollection.deleteMany({});
        await metadataCollection.deleteMany({});
        
        // Save metadata
        console.log('💾 Saving metadata...');
        await metadataCollection.insertOne({
            ...questionnaireData.metadata,
            updatedAt: new Date().toISOString()
        });
        
        // Save questionnaire groups, questionnaires, and questions
        console.log('💾 Saving questionnaire groups and data...');
        
        for (const group of questionnaireData.questionnaireGroups) {
            // Save questionnaire group
            const groupDoc = {
                _id: group.id,
                id: group.id,
                name: group.name,
                description: group.description,
                order: group.order,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await questionnaireGroupsCollection.insertOne(groupDoc);
            console.log(`📁 Saved group: ${group.name}`);
            
            // Save questionnaires for this group
            for (const questionnaire of group.questionnaires) {
                const questionnaireDoc = {
                    _id: questionnaire.id,
                    id: questionnaire.id,
                    groupId: group.id,
                    name: questionnaire.name,
                    description: questionnaire.description,
                    order: questionnaire.order,
                    questionCount: questionnaire.questions.length,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                await questionnairesCollection.insertOne(questionnaireDoc);
                console.log(`  📋 Saved questionnaire: ${questionnaire.name} (${questionnaire.questions.length} questions)`);
                
                // Save questions for this questionnaire
                const questionDocs = questionnaire.questions.map(question => ({
                    _id: question.id,
                    id: question.id,
                    questionnaireId: questionnaire.id,
                    groupId: group.id,
                    text: question.text,
                    type: question.type,
                    required: question.required,
                    options: question.options,
                    category: question.category,
                    order: question.order,
                    inputType: question.inputType,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }));
                
                if (questionDocs.length > 0) {
                    await questionsCollection.insertMany(questionDocs);
                }
            }
        }
        
        // Create indexes for better performance
        console.log('🔍 Creating database indexes...');
        
        // Indexes for questionnaire_groups
        await questionnaireGroupsCollection.createIndex({ order: 1 });
        
        // Indexes for questionnaires
        await questionnairesCollection.createIndex({ groupId: 1 });
        await questionnairesCollection.createIndex({ order: 1 });
        await questionnairesCollection.createIndex({ groupId: 1, order: 1 });
        
        // Indexes for questions
        await questionsCollection.createIndex({ questionnaireId: 1 });
        await questionsCollection.createIndex({ groupId: 1 });
        await questionsCollection.createIndex({ order: 1 });
        await questionsCollection.createIndex({ questionnaireId: 1, order: 1 });
        await questionsCollection.createIndex({ type: 1 });
        await questionsCollection.createIndex({ required: 1 });
        
        // Display summary
        console.log('\n✅ Questionnaire data successfully saved to MongoDB!');
        console.log('\n📊 Summary:');
        console.log(`📁 Groups: ${questionnaireData.metadata.totalGroups}`);
        console.log(`❓ Questions: ${questionnaireData.metadata.totalQuestions}`);
        
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
                text: sampleQuestion.text,
                type: sampleQuestion.type,
                required: sampleQuestion.required,
                optionsCount: sampleQuestion.options?.length || 0
            }, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error saving questionnaires to MongoDB:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 MongoDB connection closed');
        }
    }
}

// Helper function to get questionnaire data for API usage
async function getQuestionnaireStructure(): Promise<any> {
    let client: MongoClient | null = null;
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        // Get all groups with their questionnaires and questions
        const groups = await db.collection('questionnaire_groups')
            .find({})
            .sort({ order: 1 })
            .toArray();
        
        const result = [];
        
        for (const group of groups) {
            const questionnaires = await db.collection('questionnaires')
                .find({ groupId: group.id })
                .sort({ order: 1 })
                .toArray();
            
            const groupData = {
                ...group,
                questionnaires: []
            };
            
            for (const questionnaire of questionnaires) {
                const questions = await db.collection('questions')
                    .find({ questionnaireId: questionnaire.id })
                    .sort({ order: 1 })
                    .toArray();
                
                groupData.questionnaires.push({
                    ...questionnaire,
                    questions
                });
            }
            
            result.push(groupData);
        }
        
        return result;
        
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Helper function to get questions by group
async function getQuestionsByGroup(groupId: string): Promise<Question[]> {
    let client: MongoClient | null = null;
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        const db = client.db(DATABASE_NAME);
        
        const questions = await db.collection('questions')
            .find({ groupId })
            .sort({ order: 1 })
            .toArray();
        
        return questions;
        
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the script
if (require.main === module) {
    saveQuestionnairesToMongoDB()
        .then(() => {
            console.log('🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = {
    saveQuestionnairesToMongoDB,
    getQuestionnaireStructure,
    getQuestionsByGroup
};
