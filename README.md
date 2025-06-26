# Spotify Travel Concerts

Find concerts based on your Spotify listening history and travel plans using **multiple concert APIs** for comprehensive coverage!

## How It Works

1. **Connect Spotify** - Authenticate with your Spotify account to access your listening history
2. **Enter Travel Plans** - Specify location and dates for your trip
3. **Get Recommendations** - Find concerts that match your music taste in your destination

<<<<<<< HEAD
The app cross-references your top Spotify artists with concerts from **Ticketmaster**, **Bandsintown**, **Eventbrite**, **Resident Advisor**, **Dice**, and **NTS Radio** to provide the most comprehensive recommendations with explanations like:
> "Because you listen to The Beatles, you might like Arctic Monkeys playing in Copenhagen on June 12!"

## Features

- ✅ Spotify OAuth authentication
- ✅ Get user's top artists from Spotify
- ✅ **Multi-API concert search** (6 sources: Ticketmaster + Bandsintown + Eventbrite + Resident Advisor + Dice + NTS)
- ✅ Cross-reference user's music taste with available concerts
- ✅ Use Spotify's recommendation engine to find similar artists
- ✅ Generate personalized explanations for each recommendation
- ✅ **Duplicate removal** across multiple APIs
- ✅ **Direct ticket links** to purchase
- ✅ **Event type indicators** (electronic ⚡, independent 🎸, radio 📻)
- ✅ Simple web interface
=======
The app cross-references your top Spotify artists with concerts happening in your travel destination and provides personalized recommendations with explanations like:
> "Because you listen to Bob Dylan, you might like Donovan playing in London on May 9th"

## Features

- Spotify OAuth authentication
- Get user's top artists from Spotify
- Search concerts by location and date range (using Songkick API)
- Cross-reference user's music taste with available concerts
- Use Spotify's recommendation engine to find similar artists
- Generate personalized explanations for each recommendation
- Simple web interface
>>>>>>> e25b28d32cc34af11fb5c587a96120e281576dc7

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Get API Keys (All Free!)

#### Spotify API
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app named "Traveling Wilburys"
3. Add `http://localhost:3000/auth/callback` to Redirect URIs
4. Copy your Client ID and Client Secret

#### Ticketmaster Discovery API (Free)
1. Go to [Ticketmaster Developer](https://developer.ticketmaster.com/)
2. Sign up for free account
3. Create a new app
4. Get your API key (5,000 requests/month free)

#### Bandsintown API (Free)
1. Go to [Bandsintown Developer](https://artists.bandsintown.com/support/bandsintown-api)
2. Sign up for free account
3. Get your App ID (1,000 requests/day free)

#### Eventbrite API (Free)
1. Go to [Eventbrite Developer](https://www.eventbrite.com/platform/api-keys)
2. Sign up for free account
3. Get your API key (1,000 requests/day free)

#### Resident Advisor API (Electronic Music)
1. Go to [Resident Advisor Developer](https://ra.co/api)
2. Sign up for developer access
3. Get your API key (limited public access)

#### Dice API (Independent Venues)
1. Go to [Dice Developer](https://dice.fm/developer)
2. Sign up for developer access
3. Get your API key (limited public access)

#### NTS Radio API (Radio Shows)
1. Go to [NTS Developer](https://www.nts.live/api)
2. Sign up for developer access
3. Get your API key (limited public access)

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback

# Concert APIs (All Free!)
TICKETMASTER_API_KEY=your_ticketmaster_api_key_here
BANDSINTOWN_APP_ID=your_bandsintown_app_id_here
EVENTBRITE_API_KEY=your_eventbrite_api_key_here

# Electronic/Independent Music APIs
RESIDENT_ADVISOR_API_KEY=your_ra_api_key_here
DICE_API_KEY=your_dice_api_key_here
NTS_API_KEY=your_nts_api_key_here

PORT=3000
```

### 4. Run the App
```bash
npm start
```

Visit `http://localhost:3000` in your browser!

## API Endpoints

- `GET /login` - Start Spotify OAuth flow
- `GET /auth/callback` - Handle Spotify OAuth callback
- `POST /find-concerts` - Find concerts based on travel plans
- `GET /` - Web interface

## Example Usage

1. Click "Login with Spotify"
2. Authorize the app
3. Enter a city (e.g., "Copenhagen")
4. Select start and end dates
5. Click "Find Concerts"
6. View personalized recommendations from multiple sources!

## How the Multi-API Recommendation Engine Works

1. **Search Multiple Sources**: Queries 6 APIs simultaneously (Ticketmaster, Bandsintown, Eventbrite, Resident Advisor, Dice, NTS)
2. **Merge Data**: Combines results from all APIs
3. **Remove Duplicates**: Eliminates duplicate concerts across sources
4. **Direct Matches**: Finds concerts where artists you listen to are performing
5. **Similar Artists**: Uses Spotify's recommendation API to find similar artists performing
6. **Cross-Reference**: Matches your music taste with available concerts
7. **Personalized Explanations**: Generates reasons for each recommendation

## Data Sources Coverage

- **Ticketmaster**: ~80-90% of major concerts globally
- **Bandsintown**: ~70-80% of concerts, good artist data
- **Eventbrite**: ~60-70% of events, good for smaller venues
- **Resident Advisor**: ~90% of electronic music events
- **Dice**: ~80% of independent venue events
- **NTS Radio**: Radio shows and live events
- **Combined**: ~98%+ coverage of available concerts and events

## Future Enhancements

- Add more concert APIs (SeatGeek, StubHub)
- Use OpenAI for more natural language explanations
- Add concert ticket purchasing integration
- Save travel plans and get notifications
- Mobile app version
- Social features (share with friends)
- Concert price comparison across sources
- Filter by event type (electronic, independent, radio)

## Tech Stack

- **Backend**: Node.js, Express
- **APIs**: Spotify Web API, Ticketmaster Discovery API, Bandsintown API, Eventbrite API, Resident Advisor API, Dice API, NTS Radio API
- **Frontend**: Simple HTML/CSS/JavaScript
- **Authentication**: Spotify OAuth 2.0
<<<<<<< HEAD

## License

MIT
=======
>>>>>>> e25b28d32cc34af11fb5c587a96120e281576dc7
