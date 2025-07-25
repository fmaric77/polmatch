import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

// GET: Fetch available questionnaire filters for search users page
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const profileType = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business';
    
    if (!profileType || !['basic', 'love', 'business'].includes(profileType)) {
      return NextResponse.json({ 
        success: false, 
        options: { $exists: true, $ne: [] },
      }, { status: 400 });
    }

    // Get all multiple choice questions and country question type
    const filters = await db.collection('questions').aggregate([
      {
        $match: {
          $or: [
            { question_type: { $in: ['select', 'radio', 'checkbox'] }, options: { $exists: true, $ne: [] } },
            { question_type: 'countryofcurrentresidence' } // Match by question type
          ]
        }
      },
      {
        $lookup: {
          from: 'questionnaires',
          localField: 'questionnaire_id',
          foreignField: 'questionnaire_id',
          as: 'questionnaire'
        }
      },
      {
        $unwind: '$questionnaire'
      },
      {
        $lookup: {
          from: 'questionnaire_groups',
          localField: 'questionnaire.group_id',
          foreignField: 'group_id',
          as: 'group'
        }
      },
      {
        $unwind: '$group'
      },
      {
        $match: {
          'group.profile_type': profileType,
          'group.is_hidden': false,
          'questionnaire.is_hidden': false
        }
      },
      // Insert static world country list override for the country filter
      {
        $addFields: {
          options: {
            $cond: {
              if: { $eq: ['$question_type', 'countryofcurrentresidence'] },
              then: [
                'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
                'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
                'Côte d\'Ivoire','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros',
                'Congo, Democratic Republic of the','Congo, Republic of the','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
                'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
                'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
                'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States of America','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
              ],
              else: '$options'
            }
          }
        }
      },
      {
        $project: {
          question_id: 1,
          question_text: 1,
          question_type: 1,
          options: 1,
          profile_display_text: 1,
          questionnaire_title: '$questionnaire.title',
          group_title: '$group.title'
        }
      },
      {
        $sort: { questionnaire_title: 1, display_order: 1 }
      }
    ]).toArray();

    return NextResponse.json({ 
      success: true, 
      filters,
      profile_type: profileType
    });

  } catch (error) {
    console.error('Error fetching questionnaire filters:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch filters' 
    }, { status: 500 });
  }
}