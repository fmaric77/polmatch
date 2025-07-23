const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const DATABASE_NAME = 'polmatch';

// Get list of countries from the GeoJSON file
const fs = require('fs');
const geojson = JSON.parse(fs.readFileSync('/home/filip/Desktop/pol/public/continents-geo.json', 'utf8'));
const countries = geojson.features
  .map(f => f.properties.admin || f.properties.name)
  .filter(name => name && name !== 'Antarctica')
  .sort()
  .filter((name, index, arr) => arr.indexOf(name) === index);

async function addCountryQuestion() {
  let client = null;
  
  try {
    console.log('🌍 Adding Current Country of Residence question...\n');
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    
    // First, find the demographics questionnaire group
    const demographicsGroup = await db.collection('questionnaire_groups').findOne({
      name: { $regex: /demographics/i }
    });
    
    if (!demographicsGroup) {
      console.log('❌ Demographics questionnaire group not found');
      return;
    }
    
    console.log(`✅ Found demographics group: ${demographicsGroup.name}`);
    
    // Find the demographics questionnaire
    const demographicsQuestionnaire = await db.collection('questionnaires').findOne({
      group_id: demographicsGroup.group_id
    });
    
    if (!demographicsQuestionnaire) {
      console.log('❌ Demographics questionnaire not found');
      return;
    }
    
    console.log(`✅ Found demographics questionnaire: ${demographicsQuestionnaire.name}`);
    
    // Check if the question already exists
    const existingQuestion = await db.collection('questions').findOne({
      question_text: { $regex: /current.*country.*residence/i }
    });
    
    if (existingQuestion) {
      console.log('⚠️ Country residence question already exists');
      return;
    }
    
    // Get the highest display order for this questionnaire
    const lastQuestion = await db.collection('questions')
      .find({ questionnaire_id: demographicsQuestionnaire.questionnaire_id })
      .sort({ display_order: -1 })
      .limit(1)
      .toArray();
    
    const newDisplayOrder = lastQuestion.length > 0 ? lastQuestion[0].display_order + 1 : 1;
    
    // Create the country options
    const countryOptions = countries.map((country, index) => ({
      option_id: `country_${index + 1}`,
      option_text: country,
      option_value: country
    }));
    
    // Create the new question
    const newQuestion = {
      question_id: 'q_current_country_residence',
      questionnaire_id: demographicsQuestionnaire.questionnaire_id,
      group_id: demographicsGroup.group_id,
      question_text: 'What is your current country of residence?',
      question_type: 'currentcountry', // Special question type
      is_required: true,
      display_order: newDisplayOrder,
      profile_display_text: 'Current Country',
      created_at: new Date(),
      options: countryOptions,
      category: 'demographics_and_location',
      profileType: 'basic'
    };
    
    // Insert the question
    const result = await db.collection('questions').insertOne(newQuestion);
    
    if (result.acknowledged) {
      console.log(`✅ Successfully added country residence question with ${countries.length} country options`);
      console.log(`📍 Question ID: ${newQuestion.question_id}`);
      console.log(`📋 Questionnaire: ${demographicsQuestionnaire.name}`);
      console.log(`🔢 Display Order: ${newDisplayOrder}`);
    } else {
      console.log('❌ Failed to add question');
    }
    
  } catch (error) {
    console.error('❌ Error adding country question:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  addCountryQuestion();
}

module.exports = { addCountryQuestion };
