const express = require('express');
const axios = require('axios');
const cors = require('cors');
const querystring = require('querystring');
const { findIntelligentMatches } = require('./services/aiService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store user tokens (in production, use a database)
const userTokens = {};

// Spotify API endpoints
const SPOTIFY_API = 'https://api.spotify.com/v1';
const TICKETMASTER_API = 'https://app.ticketmaster.com/discovery/v2';
const BANDSINTOWN_API = 'https://rest.bandsintown.com';
const EVENTBRITE_API = 'https://www.eventbriteapi.com/v3';
const RESIDENT_ADVISOR_API = 'https://ra.co/api/v1';
const DICE_API = 'https://api.dice.fm/v1';
const NTS_API = 'https://www.nts.live/api/v2';

// Routes

// 1. Start Spotify OAuth
app.get('/login', (req, res) => {
    const scope = 'user-top-read user-read-recently-played';
    const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
        response_type: 'code',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: scope,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        state: 'some-random-state'
    })}`;
    res.json({ authUrl });
});

// 2. Handle Spotify OAuth callback
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI
            }), {
                headers: {
                    'Authorization': `Basic ${Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, refresh_token } = tokenResponse.data;
        
        // Get user profile
        const userResponse = await axios.get(`${SPOTIFY_API}/me`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const userId = userResponse.data.id;
        userTokens[userId] = { access_token, refresh_token };

        // Redirect back to main app with userId
        res.redirect(`/?userId=${userId}&auth=success`);

    } catch (error) {
        console.error('Auth error:', error);
        res.redirect('/?auth=error');
    }
});

// 3. Get user's top artists from Spotify
async function getUserTopArtists(userId) {
    try {
        const response = await axios.get(`${SPOTIFY_API}/me/top/artists?limit=20`, {
            headers: { 'Authorization': `Bearer ${userTokens[userId].access_token}` }
        });
        return response.data.items.map(artist => ({
            name: artist.name,
            genres: artist.genres,
            popularity: artist.popularity
        }));
    } catch (error) {
        console.error('Error fetching top artists:', error);
        return [];
    }
}

// 4. Search for concerts across multiple APIs
async function searchConcerts(location, startDate, endDate) {
    console.log(`🔍 Starting concert search for ${location} from ${startDate} to ${endDate}`);
    const allConcerts = [];
    const apiResults = {
        ticketmaster: { success: false, count: 0, error: null },
        bandsintown: { success: false, count: 0, error: null },
        eventbrite: { success: false, count: 0, error: null }
    };
    
    // Search Ticketmaster Discovery API
    try {
        console.log('🎫 Searching Ticketmaster...');
        if (!process.env.TICKETMASTER_API_KEY) {
            throw new Error('Ticketmaster API key not configured');
        }
        
        const ticketmasterResponse = await axios.get(`${TICKETMASTER_API}/events.json`, {
            params: {
                apikey: process.env.TICKETMASTER_API_KEY,
                city: location,
                startDateTime: `${startDate}T00:00:00Z`,
                endDateTime: `${endDate}T23:59:59Z`,
                classificationName: 'music',
                size: 50
            },
            timeout: 10000 // 10 second timeout for Vercel
        });

        if (ticketmasterResponse.data._embedded && ticketmasterResponse.data._embedded.events) {
            const ticketmasterEvents = ticketmasterResponse.data._embedded.events.map(event => ({
                name: event.name,
                date: event.dates.start.localDate,
                venue: event._embedded.venues[0].name,
                city: event._embedded.venues[0].city.name,
                artists: event._embedded.attractions ? event._embedded.attractions.map(attraction => attraction.name) : [event.name],
                source: 'Ticketmaster',
                url: event.url
            }));
            allConcerts.push(...ticketmasterEvents);
            apiResults.ticketmaster = { success: true, count: ticketmasterEvents.length, error: null };
            console.log(`✅ Ticketmaster: Found ${ticketmasterEvents.length} events`);
        } else {
            apiResults.ticketmaster = { success: true, count: 0, error: 'No events found' };
            console.log('⚠️ Ticketmaster: No events in response');
        }
    } catch (error) {
        apiResults.ticketmaster = { success: false, count: 0, error: error.message };
        console.log('❌ Ticketmaster API error:', error.message);
    }

    // Search Bandsintown API (simplified approach)
    try {
        console.log('🎵 Searching Bandsintown...');
        const bandsintownResponse = await axios.get(`${BANDSINTOWN_API}/events`, {
            params: {
                app_id: 'spotify-travel-concerts',
                location: location,
                date: `${startDate},${endDate}`
            },
            timeout: 8000 // 8 second timeout
        });

        if (bandsintownResponse.data && Array.isArray(bandsintownResponse.data) && bandsintownResponse.data.length > 0) {
            const bandsintownEvents = bandsintownResponse.data.map(event => ({
                name: event.title || event.description || 'Concert Event',
                date: event.datetime ? event.datetime.split('T')[0] : startDate,
                venue: event.venue ? event.venue.name : 'TBD',
                city: event.venue ? event.venue.city : location,
                artists: event.lineup || [event.artist?.name || 'Various Artists'],
                source: 'Bandsintown',
                url: event.url || event.facebook_rsvp_url
            }));
            allConcerts.push(...bandsintownEvents);
            apiResults.bandsintown = { success: true, count: bandsintownEvents.length, error: null };
            console.log(`✅ Bandsintown: Found ${bandsintownEvents.length} events`);
        } else {
            apiResults.bandsintown = { success: true, count: 0, error: 'No events found' };
            console.log('⚠️ Bandsintown: No events in response');
        }
    } catch (error) {
        apiResults.bandsintown = { success: false, count: 0, error: error.message };
        console.log('❌ Bandsintown API error:', error.message);
    }

    // Search Eventbrite API
    try {
        console.log('🎪 Searching Eventbrite...');
        if (!process.env.EVENTBRITE_API_KEY) {
            throw new Error('Eventbrite API key not configured');
        }
        
        const eventbriteResponse = await axios.get(`${EVENTBRITE_API}/events/search/`, {
            params: {
                token: process.env.EVENTBRITE_API_KEY,
                'location.address': location,
                'start_date.range_start': `${startDate}T00:00:00Z`,
                'start_date.range_end': `${endDate}T23:59:59Z`,
                categories: '103', // Music category
                expand: 'venue'
            },
            timeout: 8000
        });

        if (eventbriteResponse.data.events && eventbriteResponse.data.events.length > 0) {
            const eventbriteEvents = eventbriteResponse.data.events.map(event => ({
                name: event.name.text,
                date: event.start.local.split('T')[0],
                venue: event.venue ? event.venue.name : 'TBD',
                city: event.venue ? event.venue.address.city : location,
                artists: [event.name.text],
                source: 'Eventbrite',
                url: event.url
            }));
            allConcerts.push(...eventbriteEvents);
            apiResults.eventbrite = { success: true, count: eventbriteEvents.length, error: null };
            console.log(`✅ Eventbrite: Found ${eventbriteEvents.length} events`);
        } else {
            apiResults.eventbrite = { success: true, count: 0, error: 'No events found' };
            console.log('⚠️ Eventbrite: No events in response');
        }
    } catch (error) {
        apiResults.eventbrite = { success: false, count: 0, error: error.message };
        console.log('❌ Eventbrite API error:', error.message);
    }

    // Log final results for debugging
    console.log('📊 API Results Summary:', JSON.stringify(apiResults, null, 2));
    console.log(`🎉 Total concerts found: ${allConcerts.length}`);

    // Remove duplicates and sort
    const uniqueConcerts = allConcerts.filter((concert, index, self) => 
        index === self.findIndex(c => 
            c.name.toLowerCase() === concert.name.toLowerCase() &&
            c.date === concert.date &&
            c.venue.toLowerCase() === concert.venue.toLowerCase()
        )
    );

    uniqueConcerts.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(`✨ Unique concerts after deduplication: ${uniqueConcerts.length}`);
    
    // Add debug info to response
    uniqueConcerts._debug = {
        searchParams: { location, startDate, endDate },
        apiResults,
        totalFound: allConcerts.length,
        afterDedup: uniqueConcerts.length
    };

    return uniqueConcerts;
}

// 5. Get Spotify recommendations for an artist
async function getSpotifyRecommendations(userId, seedArtist) {
    try {
        // First, search for the artist to get their Spotify ID
        const searchResponse = await axios.get(`${SPOTIFY_API}/search`, {
            params: { q: seedArtist, type: 'artist', limit: 1 },
            headers: { 'Authorization': `Bearer ${userTokens[userId].access_token}` }
        });

        if (!searchResponse.data.artists.items.length) {
            return [];
        }

        const artistId = searchResponse.data.artists.items[0].id;

        // Get recommendations based on this artist
        const recommendationsResponse = await axios.get(`${SPOTIFY_API}/recommendations`, {
            params: {
                seed_artists: artistId,
                limit: 10
            },
            headers: { 'Authorization': `Bearer ${userTokens[userId].access_token}` }
        });

        return recommendationsResponse.data.tracks.map(track => ({
            name: track.name,
            artist: track.artists[0].name,
            popularity: track.popularity
        }));

    } catch (error) {
        console.error('Error getting recommendations:', error);
        return [];
    }
}

// 6. Main endpoint: Find concerts based on travel plans
app.post('/find-concerts', async (req, res) => {
    const { userId, location, startDate, endDate } = req.body;

    if (!userTokens[userId]) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        // Get user's top artists
        const topArtists = await getUserTopArtists(userId);
        
        // Search for concerts in the location and date range
        const concerts = await searchConcerts(location, startDate, endDate);

        // Cross-reference and create recommendations
        const recommendations = [];

        // 1. Direct matches (exact artist names)
        for (const concert of concerts) {
            for (const artist of topArtists) {
                if (concert.artists.some(concertArtist => 
                    concertArtist.toLowerCase().includes(artist.name.toLowerCase()) ||
                    artist.name.toLowerCase().includes(concertArtist.toLowerCase())
                )) {
                    recommendations.push({
                        type: 'direct_match',
                        concert: concert,
                        reason: `Because you listen to ${artist.name}, you might like this concert!`,
                        matchArtist: artist.name,
                        confidence: 0.95
                    });
                }
            }
        }

        // 2. AI-enhanced recommendations
        try {
            const aiRecommendations = await findIntelligentMatches(topArtists, concerts);
            
            for (const aiMatch of aiRecommendations) {
                const matchedConcert = concerts.find(c => c.name === aiMatch.concertName);
                if (matchedConcert && !recommendations.some(r => r.concert.name === matchedConcert.name)) {
                    recommendations.push({
                        type: 'ai_match',
                        concert: matchedConcert,
                        reason: aiMatch.reason,
                        confidence: aiMatch.confidence
                    });
                }
            }
        } catch (error) {
            console.log('AI recommendations unavailable:', error.message);
        }

        // 3. Spotify similarity fallback (for remaining concerts)
        for (const artist of topArtists.slice(0, 3)) {
            const similarArtists = await getSpotifyRecommendations(userId, artist.name);
            
            for (const concert of concerts) {
                // Skip if already recommended
                if (recommendations.some(r => r.concert.name === concert.name)) continue;
                
                for (const similarArtist of similarArtists.slice(0, 5)) {
                    if (concert.artists.some(concertArtist => 
                        concertArtist.toLowerCase().includes(similarArtist.artist.toLowerCase()) ||
                        similarArtist.artist.toLowerCase().includes(concertArtist.toLowerCase())
                    )) {
                        recommendations.push({
                            type: 'spotify_similar',
                            concert: concert,
                            reason: `Because you listen to ${artist.name}, you might like ${similarArtist.artist} playing in ${concert.city}!`,
                            matchArtist: similarArtist.artist,
                            basedOn: artist.name,
                            confidence: 0.7
                        });
                        break;
                    }
                }
            }
        }

        // Sort by confidence and remove duplicates
        const uniqueRecommendations = recommendations
            .filter((rec, index, self) => 
                index === self.findIndex(r => r.concert.name === rec.concert.name)
            )
            .sort((a, b) => (b.confidence || 0.5) - (a.confidence || 0.5))
            .slice(0, 10);

        res.json({
            location: location,
            dateRange: { start: startDate, end: endDate },
            userTopArtists: topArtists.slice(0, 5),
            totalConcertsFound: concerts.length,
            recommendations: uniqueRecommendations,
            aiEnabled: !!process.env.OPENAI_API_KEY,
            debug: concerts._debug
        });

    } catch (error) {
        console.error('Error finding concerts:', error);
        res.status(500).json({ error: 'Failed to find concerts' });
    }
});

// 7. Simple frontend
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Spotify Travel Concerts</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .container { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; }
                button { background: #1DB954; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
                input, select { padding: 8px; margin: 5px; border-radius: 5px; border: 1px solid #ddd; }
                .recommendation { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #1DB954; }
            </style>
        </head>
        <body>
            <h1>🎵 Find Concerts Based on Your Spotify Taste</h1>
            
            <div class="container">
                <h2>Step 1: Connect Spotify</h2>
                <button onclick="login()">Login with Spotify</button>
                <div id="authStatus"></div>
            </div>

            <div class="container">
                <h2>Step 2: Enter Travel Plans</h2>
                <input type="text" id="location" placeholder="City (e.g., Copenhagen)" />
                <input type="date" id="startDate" />
                <input type="date" id="endDate" />
                <button onclick="findConcerts()">Find Concerts</button>
            </div>

            <div id="results"></div>

            <script>
                let userId = null;

                // Check URL parameters for authentication result
                const urlParams = new URLSearchParams(window.location.search);
                const authStatus = urlParams.get('auth');
                const userIdFromUrl = urlParams.get('userId');

                if (authStatus === 'success' && userIdFromUrl) {
                    userId = userIdFromUrl;
                    document.getElementById('authStatus').innerHTML = '<p style="color: green;">✅ Successfully authenticated with Spotify! You can now search for concerts.</p>';
                    // Clean up URL parameters
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else if (authStatus === 'error') {
                    document.getElementById('authStatus').innerHTML = '<p style="color: red;">❌ Authentication failed. Please try again.</p>';
                    // Clean up URL parameters
                    window.history.replaceState({}, document.title, window.location.pathname);
                }

                async function login() {
                    const response = await fetch('/login');
                    const data = await response.json();
                    window.location.href = data.authUrl;
                }

                async function findConcerts() {
                    if (!userId) {
                        alert('Please login with Spotify first!');
                        return;
                    }

                    const location = document.getElementById('location').value;
                    const startDate = document.getElementById('startDate').value;
                    const endDate = document.getElementById('endDate').value;

                    if (!location || !startDate || !endDate) {
                        alert('Please fill in all fields!');
                        return;
                    }

                    // Show loading state
                    document.getElementById('results').innerHTML = '<div class="container"><p>🔍 Searching concerts across multiple platforms...</p></div>';

                    const response = await fetch('/find-concerts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, location, startDate, endDate })
                    });

                    const data = await response.json();
                    displayResults(data);
                }

                function displayResults(data) {
                    const resultsDiv = document.getElementById('results');
                    
                    let html = \`
                        <div class="container">
                            <h2>🎵 Concert Search Results for \${data.location}</h2>
                            <p><strong>📅 Date Range:</strong> \${data.dateRange.start} to \${data.dateRange.end}</p>
                            <p><strong>🔍 Total Concerts Found:</strong> \${data.totalConcertsFound}</p>
                            <p><strong>🎧 Your Top Artists:</strong> \${data.userTopArtists.map(artist => artist.name).join(', ')}</p>
                            <p><strong>🤖 AI Enhanced:</strong> \${data.aiEnabled ? '✅ Enabled' : '❌ Not Available'}</p>
                    \`;

                    // Show debug info if available
                    if (data.debug) {
                        html += \`
                            <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 12px;">
                                <strong>🔧 Debug Info:</strong><br>
                                <strong>Ticketmaster:</strong> \${data.debug.apiResults.ticketmaster.success ? 
                                    \`✅ \${data.debug.apiResults.ticketmaster.count} events\` : 
                                    \`❌ \${data.debug.apiResults.ticketmaster.error}\`}<br>
                                <strong>Bandsintown:</strong> \${data.debug.apiResults.bandsintown.success ? 
                                    \`✅ \${data.debug.apiResults.bandsintown.count} events\` : 
                                    \`❌ \${data.debug.apiResults.bandsintown.error}\`}<br>
                                <strong>Eventbrite:</strong> \${data.debug.apiResults.eventbrite.success ? 
                                    \`✅ \${data.debug.apiResults.eventbrite.count} events\` : 
                                    \`❌ \${data.debug.apiResults.eventbrite.error}\`}<br>
                                <strong>Total Found:</strong> \${data.debug.totalFound} → <strong>After Dedup:</strong> \${data.debug.afterDedup}
                            </div>
                        \`;
                    }

                    html += '<h3>🎯 Personalized Recommendations:</h3>';

                    if (data.recommendations.length === 0) {
                        html += '<p>😔 No concerts found that match your music taste for this location and dates.</p>';
                        if (data.totalConcertsFound > 0) {
                            html += '<p>💡 Try searching for a different location or expanding your date range.</p>';
                        } else {
                            html += '<p>💡 No concerts were found at all. This might be due to:</p>';
                            html += '<ul>';
                            html += '<li>🌍 The location name might not be recognized by the APIs</li>';
                            html += '<li>📅 No events scheduled for these dates</li>';
                            html += '<li>🔧 API issues (check debug info above)</li>';
                            html += '</ul>';
                        }
                    } else {
                        data.recommendations.forEach(rec => {
                            const typeIcon = rec.concert.type === 'electronic' ? '⚡' : 
                                           rec.concert.type === 'independent' ? '🎸' : 
                                           rec.concert.type === 'radio' ? '📻' : '🎵';
                            
                            const matchIcon = rec.type === 'direct_match' ? '🎯' :
                                            rec.type === 'ai_match' ? '🤖' :
                                            rec.type === 'spotify_similar' ? '🎵' : '💡';
                            
                            const confidenceBar = rec.confidence ? 
                                \`<div style="background: #ddd; border-radius: 10px; height: 4px; margin: 5px 0;">
                                    <div style="background: #1DB954; height: 4px; border-radius: 10px; width: \${rec.confidence * 100}%;"></div>
                                 </div>\` : '';
                            
                            html += \`
                                <div class="recommendation">
                                    <h4>\${typeIcon} \${rec.concert.name} \${matchIcon}</h4>
                                    <p><strong>📅 Date:</strong> \${rec.concert.date}</p>
                                    <p><strong>🏛️ Venue:</strong> \${rec.concert.venue}</p>
                                    <p><strong>🎤 Artists:</strong> \${rec.concert.artists.join(', ')}</p>
                                    <p><strong>📍 Source:</strong> \${rec.concert.source}</p>
                                    <p><em>💡 \${rec.reason}</em></p>
                                    \${confidenceBar}
                                    \${rec.concert.url ? \`<p><a href="\${rec.concert.url}" target="_blank">🎫 Get Tickets</a></p>\` : ''}
                                </div>
                            \`;
                        });
                    }

                    html += '</div>';
                    resultsDiv.innerHTML = html;
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📝 Make sure to:');
    console.log('1. Create a .env file with your API keys');
    console.log('2. Set up a Spotify app at https://developer.spotify.com/dashboard');
    console.log('3. Get a Songkick API key at https://www.songkick.com/developer');
}); 