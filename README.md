# FlickStream — Vidking Carousel Version

## Setup
1. Open this folder in VS Code.
2. Open `config.js` and replace `PASTE_YOUR_TMDB_API_KEY_HERE` with your TMDB v3 API key.
3. Install the VS Code extension **Live Server**.
4. Right-click `index.html` and choose **Open with Live Server**.

## Included
- Featured autoplay carousel with arrows, dots, hover pause and keyboard controls
- Trending movies and TV shows
- Popular, top-rated, upcoming, now-playing and on-air sections
- Live movie and TV search suggestions
- Movie and TV detail views
- TV season and episode selector
- Watchlist stored in localStorage
- Vidking movie and TV embeds
- Playback progress saving and resume support
- Subtitle/CC help
- Responsive layout

## Vidking player routes
- Movie: `https://www.vidking.net/embed/movie/{tmdbId}`
- TV: `https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}`

The project enables Vidking's `color`, `autoPlay`, `nextEpisode`, `episodeSelector`, and `progress` parameters. Player progress messages are saved to localStorage after validating the sender origin and content ID.

Important: frontend JavaScript cannot hide a TMDB API key. Use a backend or serverless proxy before production. Only stream content you are authorized to provide.
