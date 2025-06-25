const express = require('express');
const axios = require('axios');
const cors = require('cors');
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store user tokens (in production, use a database)
const userTokens = {};

// Spotify API endpoints
const SPOTIFY_API = 'https://api.spotify.com/v1';
const SONGKICK_API = 'https://api.songkick.com/api/3.0';

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

        res.json({ 
            success: true, 
            userId: userId,
            message: 'Successfully authenticated with Spotify!' 
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
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

// 4. Search for concerts in a location and date range
async function searchConcerts(location, startDate, endDate) {
    try {
        // First, search for the location
        const locationResponse = await axios.get(`${SONGKICK_API}/search/locations.json`, {
            params: {
                query: location,
                apikey: process.env.SONGKICK_API_KEY
            }
        });

        if (!locationResponse.data.resultsPage.results.location) {
            return [];
        }

        const locationId = locationResponse.data.resultsPage.results.location[0].metroArea.id;

        // Then search for events in that location
        const eventsResponse = await axios.get(`${SONGKICK_API}/metro_areas/${locationId}/calendar.json`, {
            params: {
                apikey: process.env.SONGKICK_API_KEY,
                min_date: startDate,
                max_date: endDate
            }
        });

        const events = eventsResponse.data.resultsPage.results.event || [];
        return events.map(event => ({
            name: event.displayName,
            date: event.start.date,
            venue: event.venue.displayName,
            city: event.venue.metroArea.displayName,
            artists: event.performance.map(p => p.artist.displayName)
        }));

    } catch (error) {
        console.error('Error searching concerts:', error);
        return [];
    }
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

        // Direct matches (artists user listens to are playing)
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
                        matchArtist: artist.name
                    });
                }
            }
        }

        // Similar artists (using Spotify recommendations)
        for (const artist of topArtists.slice(0, 3)) { // Check top 3 artists
            const similarArtists = await getSpotifyRecommendations(userId, artist.name);
            
            for (const concert of concerts) {
                for (const similarArtist of similarArtists.slice(0, 5)) { // Check top 5 similar
                    if (concert.artists.some(concertArtist => 
                        concertArtist.toLowerCase().includes(similarArtist.artist.toLowerCase()) ||
                        similarArtist.artist.toLowerCase().includes(concertArtist.toLowerCase())
                    )) {
                        recommendations.push({
                            type: 'similar_artist',
                            concert: concert,
                            reason: `Because you listen to ${artist.name}, you might like ${similarArtist.artist} playing in ${concert.city}!`,
                            matchArtist: similarArtist.artist,
                            basedOn: artist.name
                        });
                    }
                }
            }
        }

        // Remove duplicates
        const uniqueRecommendations = recommendations.filter((rec, index, self) => 
            index === self.findIndex(r => r.concert.name === rec.concert.name)
        );

        res.json({
            location: location,
            dateRange: { start: startDate, end: endDate },
            userTopArtists: topArtists.slice(0, 5),
            totalConcertsFound: concerts.length,
            recommendations: uniqueRecommendations.slice(0, 10) // Limit to top 10
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
                            <h2>🎤 Concerts in \${data.location}</h2>
                            <p><strong>Date Range:</strong> \${data.dateRange.start} to \${data.dateRange.end}</p>
                            <p><strong>Total Concerts Found:</strong> \${data.totalConcertsFound}</p>
                            
                            <h3>Your Top Artists:</h3>
                            <p>\${data.userTopArtists.map(artist => artist.name).join(', ')}</p>
                            
                            <h3>🎵 Recommendations:</h3>
                    \`;

                    if (data.recommendations.length === 0) {
                        html += '<p>No concerts found that match your music taste for this location and dates.</p>';
                    } else {
                        data.recommendations.forEach(rec => {
                            html += \`
                                <div class="recommendation">
                                    <h4>\${rec.concert.name}</h4>
                                    <p><strong>Date:</strong> \${rec.concert.date}</p>
                                    <p><strong>Venue:</strong> \${rec.concert.venue}</p>
                                    <p><strong>Artists:</strong> \${rec.concert.artists.join(', ')}</p>
                                    <p><em>💡 \${rec.reason}</em></p>
                                </div>
                            \`;
                        });
                    }

                    html += '</div>';
                    resultsDiv.innerHTML = html;
                }

                // Check if we're returning from Spotify auth
                if (window.location.pathname === '/callback') {
                    // This would normally be handled by the server, but for demo purposes
                    // we'll just show a success message
                    document.getElementById('authStatus').innerHTML = '<p style="color: green;">✅ Successfully authenticated! You can now search for concerts.</p>';
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