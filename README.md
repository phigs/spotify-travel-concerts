# Spotify Travel Concerts

Find concerts based on your Spotify listening history and travel plans!

## How It Works

1. **Connect Spotify** - Authenticate with your Spotify account to access your listening history
2. **Enter Travel Plans** - Specify location and dates for your trip
3. **Get Recommendations** - Find concerts that match your music taste in your destination

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

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Get API Keys

#### Spotify API
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000/callback` to Redirect URIs
4. Copy your Client ID and Client Secret

#### Songkick API
1. Go to [Songkick Developer](https://www.songkick.com/developer)
2. Sign up and get your API key

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
SONGKICK_API_KEY=your_songkick_api_key_here
PORT=3000
```

### 4. Run the App
```bash
npm start
```

Visit `http://localhost:3000` in your browser!

## API Endpoints

- `GET /login` - Start Spotify OAuth flow
- `GET /callback` - Handle Spotify OAuth callback
- `POST /find-concerts` - Find concerts based on travel plans
- `GET /` - Web interface

## Example Usage

1. Click "Login with Spotify"
2. Authorize the app
3. Enter a city (e.g., "Copenhagen")
4. Select start and end dates
5. Click "Find Concerts"
6. View personalized recommendations!

## How the Recommendation Engine Works

1. **Direct Matches**: Finds concerts where artists you listen to are performing
2. **Similar Artists**: Uses Spotify's recommendation API to find similar artists performing in your destination
3. **Cross-Reference**: Matches your music taste with available concerts
4. **Personalized Explanations**: Generates reasons for each recommendation

## Future Enhancements

- Add more concert APIs (Ticketmaster, Bandsintown)
- Use OpenAI for more natural language explanations
- Add concert ticket purchasing links
- Save travel plans and get notifications
- Mobile app version
- Social features (share with friends)

## Tech Stack

- **Backend**: Node.js, Express
- **APIs**: Spotify Web API, Songkick API
- **Frontend**: Simple HTML/CSS/JavaScript
- **Authentication**: Spotify OAuth 2.0
