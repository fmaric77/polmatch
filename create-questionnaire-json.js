const fs = require('fs');

// Parse the questions file and create structured JSON
function parseQuestionsFile() {
    const content = fs.readFileSync('/home/filip/Desktop/pol/questions.txt', 'utf8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    const questionnaireGroups = [];
    let currentGroup = null;
    let currentQuestion = null;
    let lineIndex = 0;
    
    // Define questionnaire groups based on content analysis
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
    
    // Create questionnaire groups with questions
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
    
    // Parse questions and categorize them
    const questions = extractQuestions(lines);
    categorizeQuestions(questions, questionnaireGroups);
    
    return questionnaireGroups;
}

function extractQuestions(lines) {
    const questions = [];
    let currentQuestion = null;
    let questionId = 1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip profile information and instructions
        if (line.includes('Profile Alias:') || 
            line.includes('Avatar Image') || 
            line.includes('Speak the truth') ||
            line.includes('Please NOTE!') ||
            line === 'Filip' ||
            line.includes('Hello, I\'m looking') ||
            line.includes('I\'m Slav, interested')) {
            continue;
        }
        
        // Detect question (ends with ?)
        if (line.endsWith('?')) {
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
        // Detect options (short lines that could be answers)
        else if (currentQuestion && line.length > 0 && line.length < 100 && 
                 !line.includes('Would you like to add anything') &&
                 !line.includes('Press Enter or Comma') &&
                 !line.includes('type as tags') &&
                 !line.includes('write as tags') &&
                 !isUserAnswer(line)) {
            
            // Check if it's a text input question
            if (line.includes('Press Enter or Comma') || 
                line.includes('type as tags') ||
                line.includes('write as tags')) {
                currentQuestion.type = 'text_input';
                currentQuestion.inputType = 'tags';
            } else if (isNumericAnswer(line)) {
                currentQuestion.type = 'number_input';
            } else if (line.length < 50 && !line.includes(' ')) {
                currentQuestion.options.push({
                    id: line.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    text: line,
                    value: line
                });
            }
        }
        // Detect open text questions
        else if (currentQuestion && (
            line.includes('Would you like to add anything') ||
            line.includes('please explain') ||
            line.includes('describe') ||
            line.includes('Tell us') ||
            line.includes('What would you like to say')
        )) {
            currentQuestion.type = 'text_area';
            currentQuestion.required = false;
        }
    }
    
    // Add the last question
    if (currentQuestion) {
        questions.push(currentQuestion);
    }
    
    return questions;
}

function isUserAnswer(line) {
    const userAnswers = [
        'Filip', '20', '177', '75', 'Hrvatska', 'Rijeka', 'Russian', 'Croatian',
        'Господе Исусе', 'I don\'t like bugs', 'Orthodox Christian', 'Slavic',
        'Pale', 'Black', 'Light Blue', '0+', 'panslavist', 'allslavist',
        'Writing', 'Programming', 'teaching russian', 'programming', 'translating',
        'teaching', 'slawenska dela', 'Русский стяг', 'traditional music',
        'Sandbox', 'Real-time strategy', 'Make a change', 'Freeing my land',
        'The goal of our group', 'We accept people', 'Slavic countries',
        'Generally my parents', 'They fill different', 'Men and women are human',
        'Keeping your word', 'Wake up, go to work', 'I like to read books',
        'I\'m a computer science', 'Speaking', 'Math', 'Poor math grades',
        'Western propagandist', 'Even 4g is bad', 'In some of them',
        'I believe the souls', 'The fate of the world', '19'
    ];
    
    return userAnswers.some(answer => line.includes(answer));
}

function isNumericAnswer(line) {
    return /^\d+$/.test(line) && parseInt(line) < 1000;
}

function categorizeQuestions(questions, questionnaireGroups) {
    const categoryKeywords = {
        'basic_profile_information': [
            'open to meeting', 'interested in finding', 'relationship', 'children',
            'reasons for registering', 'who you are', 'what you are expecting'
        ],
        'demographics_and_location': [
            'age', 'continent', 'nationality', 'country', 'region', 'city', 'town',
            'village', 'location', 'environment', 'distance', 'language'
        ],
        'physical_characteristics': [
            'sex', 'sexual orientation', 'physical condition', 'height', 'weight',
            'body type', 'exercise', 'facial hair', 'hair color', 'hair length',
            'eye color', 'tattoos', 'piercings', 'makeup', 'cosmetic surgery',
            'blood type', 'skin tone'
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
            'influencers', 'favorite quote', 'clean and tidy'
        ],
        'skills_and_abilities': [
            'skills', 'teaching', 'training', 'swim', 'horse', 'drivers license',
            'drive', 'vehicles', 'physical or mental work', 'STRENGTH', 'PERCEPTION',
            'ENDURANCE', 'CHARISMA', 'INTELLIGENCE', 'AGILITY', 'LUCK', 'Small Guns',
            'Big Guns', 'Unarmed', 'Melee', 'Throwing', 'First Aid', 'Doctor',
            'Sneak', 'Lockpick', 'Steal', 'Traps', 'Science', 'Repair', 'Driver',
            'Pilot', 'Barter', 'Gambling', 'Outdoorsman'
        ],
        'political_and_social_views': [
            'political allegiance', 'vote', 'ethnostate', 'fight and die', 'defend',
            'firearms', 'national flags', 'hate any race', 'prostitution', 'abortion',
            'death penalty', 'ritual slaughter', 'rape culture', 'wage gap',
            'feminist', 'drugs should be legal', 'same-sex', 'age of consent',
            'baby mutilation', 'board', '/pol'
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
            'Portrait', 'Name(Nickname)', 'Traits', 'good at', 'bad at', 'life story'
        ],
        'platform_feedback': [
            'bugs', 'problematic', 'missing', 'visit our platform', 'discover',
            'Rate our platform', 'thoughts to share', 'like:', 'dislike:',
            'improve our platform', 'compromising', 'security', 'comfort',
            'share the word', 'financially support', 'join our work team',
            'study the plan', 'understand the plan', 'youtube channel'
        ]
    };
    
    questions.forEach(question => {
        let bestMatch = null;
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
        } else {
            // Default to basic profile if no match found
            const defaultGroup = questionnaireGroups.find(g => g.id === 'basic_profile_information');
            if (defaultGroup) {
                question.order = defaultGroup.questionnaires[0].questions.length + 1;
                defaultGroup.questionnaires[0].questions.push(question);
            }
        }
    });
}

// Generate the JSON file
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

// Write to JSON file
fs.writeFileSync('/home/filip/Desktop/pol/questionnaire-data.json', JSON.stringify(output, null, 2));

console.log('✅ Questionnaire JSON file created successfully!');
console.log(`📊 Generated ${output.metadata.totalGroups} questionnaire groups`);
console.log(`❓ Generated ${output.metadata.totalQuestions} questions total`);
console.log('📁 File saved as: questionnaire-data.json');

// Display summary
questionnaireData.forEach(group => {
    const questionCount = group.questionnaires.reduce((total, q) => total + q.questions.length, 0);
    console.log(`📋 ${group.name}: ${questionCount} questions`);
});
