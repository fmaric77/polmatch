#!/usr/bin/env node

/**
 * Complete Questionnaire Setup Script
 * 
 * This script will:
 * 1. Parse the questions.txt file
 * 2. Create structured JSON data
 * 3. Save everything to MongoDB
 * 
 * Usage: node setup-questionnaires.js
 */

const fs = require('fs');
const { MongoClient } = require('mongodb');

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'polmatch';

console.log('🚀 Starting Questionnaire Setup Process...\n');

// Step 1: Parse questions file and create JSON
console.log('📖 Step 1: Parsing questions from file...');

function parseQuestionsFile() {
    const content = fs.readFileSync('/home/filip/Desktop/pol/questions.txt', 'utf8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    // Define questionnaire groups
    const groups = [
        {
            name: "Basic Profile Information",
            description: "Basic personal information and profile setup",
            order: 1
        },
        {
            name: "Demographics and Location", 
            description: "Age, location, nationality and basic demographics",
            order: 2
        },
        {
            name: "Physical Characteristics",
            description: "Physical appearance and characteristics",
            order: 3
        },
        {
            name: "Personality and Mental Health",
            description: "Personality traits, mental health, and psychological profile",
            order: 4
        },
        {
            name: "Lifestyle and Interests",
            description: "Hobbies, interests, daily routine, and lifestyle choices",
            order: 5
        },
        {
            name: "Skills and Abilities",
            description: "Professional skills, abilities, and capabilities",
            order: 6
        },
        {
            name: "Political and Social Views",
            description: "Political beliefs, social views, and ideological positions",
            order: 7
        },
        {
            name: "Religious and Spiritual Beliefs",
            description: "Religious affiliation and spiritual beliefs",
            order: 8
        },
        {
            name: "Relationships and Community",
            description: "Family, relationships, and community involvement",
            order: 9
        },
        {
            name: "Economic and Professional",
            description: "Work, business, economic status and opportunities",
            order: 10
        },
        {
            name: "Preparedness and Self-Sufficiency",
            description: "Emergency preparedness, self-sufficiency, and survival skills",
            order: 11
        },
        {
            name: "World Views and Conspiracy Theories",
            description: "Views on global events, conspiracy theories, and world affairs",
            order: 12
        },
        {
            name: "Gaming Profile (RPG Stats)",
            description: "RPG-style character stats and gaming preferences",
            order: 13
        },
        {
            name: "Platform Feedback",
            description: "Feedback about the platform and suggestions",
            order: 14
        }
    ];
    
    const questionnaireGroups = [];
    
    // Create questionnaire groups with empty questionnaires
    groups.forEach(group => {
        questionnaireGroups.push({
            id: group.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            name: group.name,
            description: group.description,
            order: group.order,
            questionnaires: [{
                id: `${group.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_questionnaire`,
                name: `${group.name} Questionnaire`,
                description: `Questionnaire for ${group.description.toLowerCase()}`,
                order: 1,
                questions: []
            }]
        });
    });
    
    // Extract and categorize questions
    const questions = extractQuestions(lines);
    categorizeQuestions(questions, questionnaireGroups);
    
    return questionnaireGroups;
}

function extractQuestions(lines) {
    const questions = [];
    let currentQuestion = null;
    let questionId = 1;
    
    const skipPatterns = [
        'Profile Alias:', 'Avatar Image', 'Speak the truth', 'Please NOTE!',
        'Filip', 'Hello, I\'m looking', 'I\'m Slav, interested', 'Hrvatska',
        'Rijeka', 'Primorsko-goranska', 'Virovitica', 'Russian', 'Croatian',
        'English', 'Serbian', 'Serbo-croatian', 'Croato-serbian', 'Bosnian',
        'Montenegrin', 'Polish', 'Slovak', 'Господе Исусе', 'I don\'t like bugs',
        'Generally my parents', 'The goal of our group', 'We accept people',
        'Slavic countries', 'They fill different', 'Men and women are human',
        'Keeping your word', 'Wake up, go to work', 'I like to read books',
        'I\'m a computer science', 'Speaking', 'Math', 'Poor math grades',
        'Western propagandist', 'Even 4g is bad', 'In some of them',
        'I believe the souls', 'The fate of the world', '177', '75', '20', '19'
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip user answers and profile information
        if (skipPatterns.some(pattern => line.includes(pattern))) {
            continue;
        }
        
        // Detect question (ends with ?)
        if (line.endsWith('?') && line.length > 10) {
            // Save previous question if exists
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            
            // Start new question
            currentQuestion = {
                id: `question_${questionId++}`,
                text: line,
                type: 'multiple_choice',
                required: true,
                options: [],
                category: null
            };
        }
        // Detect options for current question
        else if (currentQuestion && line.length > 0 && line.length < 100 && 
                 !line.includes('Would you like to add anything') &&
                 !line.includes('Press Enter or Comma') &&
                 !line.includes('type as tags') &&
                 !line.includes('write as tags') &&
                 !line.includes('please explain') &&
                 !isNumericRange(line)) {
            
            // Check if it's a text input question
            if (line.includes('Press Enter or Comma') || 
                line.includes('type as tags') ||
                line.includes('write as tags')) {
                currentQuestion.type = 'text_input';
                currentQuestion.inputType = 'tags';
            } else if (line.includes('Would you like to add anything') ||
                      line.includes('please explain') ||
                      line.includes('describe') ||
                      line.includes('Tell us') ||
                      line.includes('What would you like to say')) {
                currentQuestion.type = 'text_area';
                currentQuestion.required = false;
            } else if (isValidOption(line)) {
                currentQuestion.options.push({
                    id: line.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    text: line,
                    value: line
                });
            }
        }
    }
    
    // Add the last question
    if (currentQuestion) {
        questions.push(currentQuestion);
    }
    
    return questions;
}

function isNumericRange(line) {
    return /^\d+$/.test(line) && parseInt(line) < 1000 && parseInt(line) > 0;
}

function isValidOption(line) {
    const validOptions = [
        'Yes', 'No', 'Sometimes', 'Never', 'Male', 'Female', 'Single', 'Married',
        'Unmarried', 'Very Good', 'Good', 'Average', 'Fair', 'Poor', 'Bad',
        'Very Bad', 'Excellent', 'Great', 'Perfect', 'White', 'Blond', 'Red',
        'Brown', 'Black', 'Light Blue', 'Dark Blue', 'Light Brown', 'Dark Brown',
        'Green', 'Hazel', 'Heterochromia', 'Pale', 'Ivory', 'Beige', 'Medium Brown',
        'Dark Brown/Black', 'Caucasian', 'Subsaharan African', 'East Asian',
        'Middle Eastern or North African', 'South Asian', 'Amerindian', 'Mixed',
        'Slavic', 'Orthodox Christian', 'North America', 'Europe', 'Australia and Oceania',
        'East Asia', 'South Asia', 'Middle-East', 'South America', 'North Africa',
        'South Africa', 'City', 'Countryside', 'Suburbs', 'Local Friends',
        'Internet friends', 'Socially', 'I think I might be an alcoholic',
        '0+', '0-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'SPECIALIZED',
        'Just looking around', 'To discover likeminded people', 'programming',
        'translating', 'teaching', 'Internet community groups',
        'Real life community groups for local group organizing', 'Any'
    ];
    
    return validOptions.includes(line) || 
           (line.length < 50 && line.length > 1 && !line.includes(' ') && 
            !isNumericRange(line) && !/^[0-9]+$/.test(line));
}

function categorizeQuestions(questions, questionnaireGroups) {
    const categoryKeywords = {
        'basic_profile_information': [
            'open to meeting', 'interested in finding', 'relationship', 'children',
            'reasons for registering', 'who you are', 'what you are expecting'
        ],
        'demographics_and_location': [
            'age', 'continent', 'nationality', 'country', 'region', 'city', 'town',
            'village', 'location', 'environment', 'distance', 'language', 'sex'
        ],
        'physical_characteristics': [
            'sexual orientation', 'physical condition', 'height', 'weight',
            'body type', 'exercise', 'facial hair', 'hair color', 'hair length',
            'eye color', 'tattoos', 'piercings', 'makeup', 'cosmetic surgery',
            'blood type', 'skin tone', 'clean and tidy'
        ],
        'personality_and_mental_health': [
            'mental condition', 'anger issues', 'self-control', 'depression',
            'anxiety', 'phobias', 'disabilities', 'addictions', 'smoke', 'drink',
            'weed', 'drugs', 'jab', 'degenerate', 'classify yourself', 'positive',
            'negative', 'shy', 'loner', 'social', 'well-mannered', 'lonely',
            'parties', 'friends', 'alpha', 'brave', 'strong', 'agreeable',
            'assertive', 'rational', 'emotional', 'thinker', 'doer', '16personalities'
        ],
        'lifestyle_and_interests': [
            'hobbies', 'interests', 'outdoor activity', 'daily routine', 'free time',
            'books', 'movies', 'musical', 'games', 'youtubers', 'channels',
            'influencers', 'favorite quote', 'board'
        ],
        'skills_and_abilities': [
            'skills', 'teaching', 'training', 'swim', 'horse', 'drivers license',
            'drive', 'vehicles', 'physical or mental work', 'STRENGTH', 'PERCEPTION',
            'ENDURANCE', 'CHARISMA', 'INTELLIGENCE', 'AGILITY', 'LUCK', 'Small Guns',
            'Big Guns', 'Unarmed', 'Melee', 'Throwing', 'First Aid', 'Doctor',
            'Sneak', 'Lockpick', 'Steal', 'Traps', 'Science', 'Repair', 'Driver',
            'Pilot', 'Barter', 'Gambling', 'Outdoorsman', 'good at', 'bad at'
        ],
        'political_and_social_views': [
            'political allegiance', 'vote', 'ethnostate', 'fight and die', 'defend',
            'firearms', 'national flags', 'hate any race', 'prostitution', 'abortion',
            'death penalty', 'ritual slaughter', 'rape culture', 'wage gap',
            'feminist', 'drugs should be legal', 'same-sex', 'age of consent',
            'baby mutilation'
        ],
        'religious_and_spiritual_beliefs': [
            'religious persuasion', 'religious beliefs', 'religious law',
            'Religious Preferences', 'astrology', 'zodiac', 'honor'
        ],
        'relationships_and_community': [
            'animals', 'vegetarian', 'men and women', 'equal', 'respect', 'hate men',
            'hate women', 'beat a woman', 'Chivalry', 'beat kids', 'family',
            'two parents', 'community', 'real life', 'internet', 'HAM radio'
        ],
        'economic_and_professional': [
            'materialistic', 'job', 'looking for a job', 'compensated', 'debt',
            'live in the', 'priorities', 'biggest dream', 'businesses', 'hiring'
        ],
        'preparedness_and_self_sufficiency': [
            'like minded', 'aware people', 'farmer', 'farming', 'rent', 'self-sufficient',
            'food production', 'crisis', 'live with parents', 'prepper', 'prepping',
            'own land'
        ],
        'world_views_and_conspiracy_theories': [
            'future of your nation', 'born equal', 'government', 'women responsible',
            'men responsible', 'politicians', 'coronavirus', 'Earth is flat',
            'climate change', 'man-made climate', 'organized destabilization',
            'unfair treatment', 'racial erasure', 'globalist agenda', 'race matter',
            'races are equal', 'race is superior', 'multicultural society',
            'elite families', 'chosen people', 'Illuminati', 'Masons', 'alien lizards',
            'international powers', 'Trump', 'America First', 'Israel First',
            'Q Plan', 'wall', 'illegal migrants', 'Putin', 'Russia', 'traditional values',
            'political solution', 'mass awakening', 'civil war', 'revolution',
            'World War 3', 'God will save', 'fate is in God', 'World War 2',
            '9/11', 'inside job', 'historical revisionism', 'Yuri Bezmenov',
            'country is independent', 'moon landing', 'UFO', 'Aliens', 'chemicals',
            'water', '5G', 'marriage is a trap', 'demographic gap', 'REALISTIC solution',
            'Blackpilled', 'contribute to improving', 'Angelo John Gage'
        ],
        'gaming_profile_rpg_stats': [
            'Portrait', 'Name(Nickname)', 'Traits', 'life story'
        ],
        'platform_feedback': [
            'bugs', 'problematic', 'missing', 'visit our platform', 'discover',
            'Rate our platform', 'thoughts to share', 'improve our platform',
            'compromising', 'security', 'comfort', 'share the word',
            'financially support', 'join our work team', 'study the plan',
            'understand the plan', 'youtube channel'
        ]
    };
    
    questions.forEach(question => {
        let bestMatch = 'basic_profile_information';
        let maxMatches = 0;
        
        Object.keys(categoryKeywords).forEach(category => {
            const keywords = categoryKeywords[category];
            const matches = keywords.filter(keyword => 
                question.text.toLowerCase().includes(keyword.toLowerCase())
            ).length;
            
            if (matches > maxMatches) {
                maxMatches = matches;
                bestMatch = category;
            }
        });
        
        // Find the corresponding group and add question
        const group = questionnaireGroups.find(g => g.id === bestMatch);
        if (group && group.questionnaires[0]) {
            question.order = group.questionnaires[0].questions.length + 1;
            group.questionnaires[0].questions.push(question);
        }
    });
    
    // Remove empty groups
    return questionnaireGroups.filter(group => 
        group.questionnaires[0].questions.length > 0
    );
}

// Step 2: Create JSON file
console.log('📝 Step 2: Creating JSON file...');

const questionnaireData = parseQuestionsFile();

const output = {
    metadata: {
        name: "PolMatch Questionnaire System",
        description: "Complete questionnaire system for political matching platform",
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        totalGroups: questionnaireData.length,
        totalQuestions: questionnaireData.reduce((total, group) => 
            total + group.questionnaires.reduce((qtotal, q) => qtotal + q.questions.length, 0), 0
        )
    },
    questionnaireGroups: questionnaireData
};

fs.writeFileSync('/home/filip/Desktop/pol/questionnaire-data.json', JSON.stringify(output, null, 2));

console.log(`✅ JSON file created with ${output.metadata.totalGroups} groups and ${output.metadata.totalQuestions} questions\n`);

// Step 3: Save to MongoDB
console.log('💾 Step 3: Saving to MongoDB...');

async function saveToMongoDB() {
    let client = null;
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('🔌 Connected to MongoDB');
        
        const db = client.db(DATABASE_NAME);
        
        // Create collections
        const questionnaireGroupsCollection = db.collection('questionnaire_groups');
        const questionnairesCollection = db.collection('questionnaires');
        const questionsCollection = db.collection('questions');
        const metadataCollection = db.collection('questionnaire_metadata');
        
        // Clear existing data
        console.log('🗑️ Clearing existing data...');
        await questionnaireGroupsCollection.deleteMany({});
        await questionnairesCollection.deleteMany({});
        await questionsCollection.deleteMany({});
        await metadataCollection.deleteMany({});
        
        // Save metadata
        await metadataCollection.insertOne({
            ...output.metadata,
            updatedAt: new Date().toISOString()
        });
        
        console.log('💾 Saving questionnaire data...');
        
        for (const group of questionnaireData) {
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
                
                // Save questions for this questionnaire
                if (questionnaire.questions.length > 0) {
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
                    
                    await questionsCollection.insertMany(questionDocs);
                }
            }
            
            console.log(`✅ Saved: ${group.name} (${group.questionnaires[0].questions.length} questions)`);
        }
        
        // Create indexes
        console.log('🔍 Creating indexes...');
        await questionnaireGroupsCollection.createIndex({ order: 1 });
        await questionnairesCollection.createIndex({ groupId: 1, order: 1 });
        await questionsCollection.createIndex({ questionnaireId: 1, order: 1 });
        await questionsCollection.createIndex({ groupId: 1 });
        await questionsCollection.createIndex({ type: 1 });
        
        // Get final counts
        const groupCount = await questionnaireGroupsCollection.countDocuments();
        const questionnaireCount = await questionnairesCollection.countDocuments();
        const questionCount = await questionsCollection.countDocuments();
        
        console.log('\n🎉 Successfully saved to MongoDB!');
        console.log('\n📊 Final Summary:');
        console.log(`📁 Questionnaire Groups: ${groupCount}`);
        console.log(`📋 Questionnaires: ${questionnaireCount}`);
        console.log(`❓ Questions: ${questionCount}`);
        
        // Show sample data
        console.log('\n🔍 Sample Question:');
        const sampleQuestion = await questionsCollection.findOne();
        if (sampleQuestion) {
            console.log(`   "${sampleQuestion.text}"`);
            console.log(`   Type: ${sampleQuestion.type}`);
            console.log(`   Options: ${sampleQuestion.options?.length || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 MongoDB connection closed');
        }
    }
}

// Run the MongoDB save operation
saveToMongoDB()
    .then(() => {
        console.log('\n🚀 Questionnaire setup completed successfully!');
        console.log('📁 Files created:');
        console.log('   - questionnaire-data.json');
        console.log('🗄️ MongoDB collections created:');
        console.log('   - questionnaire_groups');
        console.log('   - questionnaires');
        console.log('   - questions');
        console.log('   - questionnaire_metadata');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    });
