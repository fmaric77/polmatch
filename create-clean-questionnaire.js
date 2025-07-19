const fs = require('fs');

// This script creates clean questionnaires WITHOUT user answers
// It extracts only questions and their valid options, ignoring personal responses

function createCleanQuestionnaire() {
    const content = fs.readFileSync('/home/filip/Desktop/pol/questions.txt', 'utf8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    const questionnaires = [];
    let currentQuestionnaire = null;
    let currentQuestion = null;
    let currentOptions = [];
    let questionId = 1;
    
    // Predefined valid options for common questions
    const validOptions = {
        yesNo: ['Yes', 'No'],
        yesNoSometimes: ['Yes', 'No', 'Sometimes'],
        maritalStatus: ['Married', 'Unmarried', 'Single'],
        sexOptions: ['Male', 'Female'],
        conditionScale: ['Very Bad', 'Bad', 'Poor', 'Fair', 'Average', 'Good', 'Very Good', 'Great', 'Excellent', 'Perfect'],
        selfControlScale: ['Very good', 'Good', 'So-so', 'No'],
        relationshipTypes: ['Local Friends', 'Internet friends', 'People to build a local community with', 'People to build a network of connections with', 'A community to join to'],
        registrationReasons: [
            'Just looking around',
            'To discover likeminded people', 
            'To discover a partner to create a family with',
            'To organize with like-minded people and build something to secure our future in this world',
            'To improve my personal preparations for possible crisis situations by finding people which I may rely on or build something with',
            'To find new business or work opportunities',
            'To exchange news and information',
            'Other'
        ],
        raceOptions: ['Caucasian', 'Subsaharan African', 'East Asian', 'Middle Eastern or North African', 'South Asian', 'Amerindian', 'Mixed'],
        skinTones: ['Pale', 'Ivory', 'Beige', 'Light Brown', 'Medium Brown', 'Dark Brown/Black'],
        continents: ['North America', 'Europe', 'Australia and Oceania', 'East Asia', 'South Asia', 'Middle-East', 'South America', 'North Africa', 'South Africa'],
        environmentTypes: ['Urban', 'Suburban', 'Rural', 'Remote'],
        smokingOptions: ['Yes', 'Sometimes', 'Never'],
        drinkingOptions: ['Yes', 'Sometimes', 'Socially', 'Never', 'I think I might be an alcoholic']
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip user personal data and instructions
        if (isUserPersonalData(line) || isInstruction(line)) {
            continue;
        }
        
        // Detect questions
        if (line.endsWith('?')) {
            // Save previous question
            if (currentQuestion) {
                finalizeQuestion(currentQuestion, currentOptions, validOptions);
                if (currentQuestionnaire) {
                    currentQuestionnaire.questions.push(currentQuestion);
                }
            }
            
            // Create new question
            currentQuestion = {
                id: `q_${questionId++}`,
                text: line,
                type: determineQuestionType(line),
                required: !line.includes('like to add anything'),
                options: []
            };
            currentOptions = [];
            
            // Create questionnaire if needed
            if (!currentQuestionnaire) {
                currentQuestionnaire = {
                    id: 'general_questionnaire',
                    name: 'General Profile Questionnaire',
                    description: 'Comprehensive profile questionnaire for matching',
                    questions: []
                };
            }
        }
        // Collect valid options (filter out user answers)
        else if (currentQuestion && isValidOption(line)) {
            currentOptions.push(line);
        }
    }
    
    // Finalize last question
    if (currentQuestion) {
        finalizeQuestion(currentQuestion, currentOptions, validOptions);
        if (currentQuestionnaire) {
            currentQuestionnaire.questions.push(currentQuestion);
        }
    }
    
    if (currentQuestionnaire) {
        questionnaires.push(currentQuestionnaire);
    }
    
    return questionnaires;
}

function isUserPersonalData(line) {
    // Filter out obvious personal answers
    const personalData = [
        'Filip', 'Hello, I\'m looking', 'I\'m Slav, interested', 
        'Hrvatska', 'Rijeka', 'Primorsko-goranska', 'Virovitica',
        'Croatia', 'Russian', 'Croatian', 'English', 'Serbian',
        'Господе Исусе Христе', 'I don\'t like bugs',
        'Profile Alias:', 'Avatar Image'
    ];
    
    return personalData.some(data => line.includes(data)) || 
           (line.length < 5 && /^\d+$/.test(line)); // Skip standalone numbers like "20"
}

function isInstruction(line) {
    const instructions = [
        'Speak the truth', 'Please NOTE!', 'Press Enter or Comma',
        'type as tags', 'write as tags', 'Upload your pictures',
        'being too precise might compromise'
    ];
    
    return instructions.some(instruction => line.includes(instruction));
}

function isValidOption(line) {
    // Check if line looks like a valid option (not user data)
    if (line.length > 100) return false; // Too long to be an option
    if (/^\d+$/.test(line) && line.length < 3) return false; // Standalone number like "20"
    if (line.includes('I\'m') || line.includes('Hello')) return false; // Personal response
    
    // Valid options are typically short, descriptive phrases
    return line.length > 2 && line.length < 80 && 
           !line.includes('Would you like to add') &&
           !line.includes('please explain') &&
           !line.includes('describe them');
}

function determineQuestionType(questionText) {
    const text = questionText.toLowerCase();
    
    if (text.includes('age') && !text.includes('group')) return 'number';
    if (text.includes('country') || text.includes('language') || text.includes('region')) return 'text_tags';
    if (text.includes('quote') || text.includes('say about yourself') || text.includes('tell us')) return 'textarea';
    if (text.includes('would you like to add')) return 'textarea';
    
    return 'multiple_choice';
}

function finalizeQuestion(question, options, validOptions) {
    const text = question.text.toLowerCase();
    
    // Assign predefined options based on question content
    if (text.includes('sex') && !text.includes('orientation')) {
        question.options = createOptions(validOptions.sexOptions);
    } else if (text.includes('married') || text.includes('relationship')) {
        question.options = createOptions(validOptions.maritalStatus);
    } else if (text.includes('condition')) {
        question.options = createOptions(validOptions.conditionScale);
    } else if (text.includes('self-control')) {
        question.options = createOptions(validOptions.selfControlScale);
    } else if (text.includes('interested in finding')) {
        question.options = createOptions(validOptions.relationshipTypes);
    } else if (text.includes('reasons for registering')) {
        question.options = createOptions(validOptions.registrationReasons);
    } else if (text.includes('race')) {
        question.options = createOptions(validOptions.raceOptions);
    } else if (text.includes('skin tone')) {
        question.options = createOptions(validOptions.skinTones);
    } else if (text.includes('continent')) {
        question.options = createOptions(validOptions.continents);
    } else if (text.includes('smoke') && !text.includes('weed')) {
        question.options = createOptions(validOptions.smokingOptions);
    } else if (text.includes('drink alcohol')) {
        question.options = createOptions(validOptions.drinkingOptions);
    } else if (options.length > 0) {
        // Use collected options if they seem valid
        question.options = createOptions(options.filter(opt => opt.length < 50));
    } else if (text.includes('children') || text.includes('phobias') || text.includes('depression')) {
        question.options = createOptions(validOptions.yesNo);
    } else {
        // Default to yes/no for binary questions
        question.options = createOptions(validOptions.yesNo);
    }
    
    // Ensure textarea questions don't have options
    if (question.type === 'textarea') {
        question.options = [];
    }
}

function createOptions(optionTexts) {
    return optionTexts.map((text, index) => ({
        id: `opt_${index + 1}`,
        text: text,
        value: text.toLowerCase().replace(/[^a-z0-9]/g, '_')
    }));
}

// Run the script
console.log('Creating clean questionnaire structure...');
const questionnaires = createCleanQuestionnaire();

// Save to JSON file
const outputPath = '/home/filip/Desktop/pol/clean-questionnaire.json';
fs.writeFileSync(outputPath, JSON.stringify(questionnaires, null, 2));

console.log(`Clean questionnaire saved to: ${outputPath}`);
console.log(`Found ${questionnaires[0]?.questions?.length || 0} questions`);

// Show first few questions as preview
if (questionnaires[0]?.questions) {
    console.log('\nFirst 5 questions preview:');
    questionnaires[0].questions.slice(0, 5).forEach((q, i) => {
        console.log(`${i + 1}. ${q.text}`);
        console.log(`   Type: ${q.type}`);
        console.log(`   Options: ${q.options.map(opt => opt.text).join(', ')}`);
        console.log('');
    });
}
