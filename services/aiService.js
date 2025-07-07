const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Use AI to find intelligent matches between user's music taste and available concerts
 */
async function findIntelligentMatches(userArtists, concerts) {
    if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAI API key not provided, falling back to basic matching');
        return [];
    }

    try {
        const userArtistNames = userArtists.slice(0, 10).map(a => a.name).join(', ');
        const concertList = concerts.slice(0, 20).map(c => 
            `${c.name} (${c.artists.join(', ')}) - ${c.venue}, ${c.date}`
        ).join('\n');

        const prompt = `User's favorite artists: ${userArtistNames}

Available concerts:
${concertList}

Find the top 5 concerts this user would most likely enjoy based on:
- Musical genre similarity
- Artist influences and connections
- Similar fanbase overlap
- Musical style compatibility

Return ONLY a JSON array with this exact format:
[
  {
    "concertName": "exact concert name from list",
    "reason": "brief explanation why they'd like it",
    "confidence": 0.85
  }
]`;

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a music expert. Return only valid JSON, no other text."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.3
        });

        const aiMatches = JSON.parse(response.choices[0].message.content);
        return aiMatches.filter(match => match.confidence > 0.6);

    } catch (error) {
        console.error('AI matching error:', error.message);
        return [];
    }
}

module.exports = {
    findIntelligentMatches
}; 