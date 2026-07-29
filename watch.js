const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const kind = params.get("type");
const season = Number(params.get("season"));
const episode = Number(params.get("episode"));
const expectedTitle = params.get("title") || "";

const player = document.getElementById("player");
const message = document.getElementById("message");

async function tmdb(path) {
  const url = new URL(CONFIG.TMDB_BASE_URL + path);
  url.searchParams.set("api_key", CONFIG.TMDB_API_KEY.trim());
  url.searchParams.set("language", "en-US");

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.status_message || `TMDB ${response.status}`);
  }

  return data;
}

function showError(text) {
  message.textContent = text;
  message.classList.add("error");
  player.style.display = "none";
}

function getProgressKey() {
  return kind === "tv"
    ? `watch-progress-tv-${id}-${season}-${episode}`
    : `watch-progress-movie-${id}`;
}

function getSavedProgress() {
  try {
    const saved = localStorage.getItem(getProgressKey());
    if (!saved) return 0;
    return Math.max(0, Math.floor(JSON.parse(saved).currentTime || 0));
  } catch {
    return 0;
  }
}

function buildPlayerUrl() {
  const playerParams = new URLSearchParams({
    color: CONFIG.PLAYER_COLOR || "e50914",
    autoPlay: "true",
  });

  const savedProgress = getSavedProgress();
  if (savedProgress > 0) {
    playerParams.set("progress", String(savedProgress));
  }

  if (kind === "movie") {
    return (
      `${CONFIG.PLAYER_BASE_URL}/movie/${encodeURIComponent(id)}?` +
      playerParams.toString()
    );
  }

  playerParams.set("nextEpisode", "true");
  playerParams.set("episodeSelector", "true");

  return (
    `${CONFIG.PLAYER_BASE_URL}/tv/${encodeURIComponent(id)}` +
    `/${season}/${episode}?${playerParams.toString()}`
  );
}

async function validateAndPlay() {
  if (!id || !["movie", "tv"].includes(kind)) {
    showError("Invalid content link: missing TMDB ID or media type.");
    return;
  }

  if (
    kind === "tv" &&
    (!Number.isInteger(season) || season < 1 ||
      !Number.isInteger(episode) || episode < 1)
  ) {
    showError("Invalid TV link: season or episode number is missing.");
    return;
  }

  try {
    let verifiedText;

    if (kind === "movie") {
      const movie = await tmdb(`/movie/${id}`);
      document.title = `Watch ${movie.title} | CineVerse`;
      verifiedText = `Verified ${movie.title} — TMDB ID ${id}.`;
    } else {
      const [show, episodeData] = await Promise.all([
        tmdb(`/tv/${id}`),
        tmdb(`/tv/${id}/season/${season}/episode/${episode}`),
      ]);

      document.title = `Watch ${show.name} S${season}E${episode} | CineVerse`;
      verifiedText =
        `Verified ${show.name} — Season ${season}, ` +
        `Episode ${episode}: ${episodeData.name}.`;

      if (
        expectedTitle &&
        show.name.toLowerCase() !== expectedTitle.toLowerCase()
      ) {
        console.warn("Title mismatch in URL", {
          expectedTitle,
          actualTitle: show.name,
        });
      }
    }

    const playerUrl = buildPlayerUrl();
    console.log("Verified TMDB content:", { id, kind, season, episode });
    console.log("Vidking URL:", playerUrl);

    message.textContent = `${verifiedText} Loading player...`;
    player.src = playerUrl;

    player.addEventListener(
      "load",
      () => {
        message.textContent = verifiedText;
      },
      { once: true }
    );
  } catch (error) {
    console.error("Validation failed:", error);
    showError(`Could not verify this title with TMDB: ${error.message}`);
  }
}

window.addEventListener("message", (event) => {
  const allowedOrigins = [
    "https://www.vidking.net",
    "https://vidking.net",
  ];

  if (!allowedOrigins.includes(event.origin)) return;

  let payload;
  try {
    payload = typeof event.data === "string"
      ? JSON.parse(event.data)
      : event.data;
  } catch {
    return;
  }

  if (payload?.type !== "PLAYER_EVENT" || !payload.data) return;

  const data = payload.data;
  const sameContent =
    String(data.id) === String(id) &&
    data.mediaType === kind &&
    (kind !== "tv" ||
      (Number(data.season) === season && Number(data.episode) === episode));

  if (!sameContent) return;

  localStorage.setItem(
    getProgressKey(),
    JSON.stringify({
      id: data.id,
      mediaType: data.mediaType,
      season: data.season,
      episode: data.episode,
      currentTime: Number(data.currentTime) || 0,
      duration: Number(data.duration) || 0,
      progress: Number(data.progress) || 0,
      event: data.event,
      updatedAt: Date.now(),
    })
  );
});
});

validateAndPlay();
