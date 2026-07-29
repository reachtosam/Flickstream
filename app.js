const $ = (selector) => document.querySelector(selector);

const content = $("#content");
const hero = $("#hero");
const modal = $("#modal");
const modalBody = $("#modalBody");
const searchInput = $("#searchInput");
const searchSuggestions = $("#searchSuggestions");
let featured = null;
let heroItems = [];
let heroIndex = 0;
let heroTimer = null;
let suggestionTimer = null;
let suggestionRequest = 0;


function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hideSuggestions() {
  searchSuggestions.classList.add("hidden");
  searchSuggestions.innerHTML = "";
}

function renderSuggestions(items) {
  if (!items.length) {
    searchSuggestions.innerHTML = '<div class="suggestion-message">No matching movies or TV shows.</div>';
    searchSuggestions.classList.remove("hidden");
    return;
  }

  searchSuggestions.innerHTML = items.slice(0, 8).map((item) => {
    const type = getType(item);
    const year = (getDate(item) || "").slice(0, 4) || "—";
    return `
      <button class="search-suggestion" type="button" data-id="${item.id}" data-type="${type}" role="option">
        <img src="${getImage(item.poster_path)}" alt="">
        <span>
          <span class="suggestion-title">${escapeText(getTitle(item))}</span>
          <span class="suggestion-meta">${year} · ★ ${(Number(item.vote_average) || 0).toFixed(1)}</span>
        </span>
        <span class="suggestion-type">${type === "tv" ? "TV" : "Movie"}</span>
      </button>`;
  }).join("");

  searchSuggestions.classList.remove("hidden");
  searchSuggestions.querySelectorAll(".search-suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      searchInput.value = button.querySelector(".suggestion-title").textContent;
      hideSuggestions();
      openDetails(button.dataset.id, button.dataset.type);
    });
  });
}

async function loadSearchSuggestions(query) {
  const requestId = ++suggestionRequest;
  try {
    const data = await api("/search/multi", { query, include_adult: false, page: 1 });
    if (requestId !== suggestionRequest) return;
    const results = (data.results || [])
      .filter((item) => ["movie", "tv"].includes(item.media_type))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    renderSuggestions(results);
  } catch (error) {
    if (requestId !== suggestionRequest) return;
    searchSuggestions.innerHTML = `<div class="suggestion-message error">Suggestions failed: ${escapeText(error.message)}</div>`;
    searchSuggestions.classList.remove("hidden");
  }
}

function showMessage(message, isError = false) {
  content.innerHTML = `<div class="empty${isError ? " error" : ""}">${message}</div>`;
}

async function api(path, params = {}) {
  const url = new URL(CONFIG.TMDB_BASE_URL + path);
  url.searchParams.set("api_key", CONFIG.TMDB_API_KEY.trim());
  url.searchParams.set("language", "en-US");

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  let data = null;

  try {
    data = await response.json();
  } catch {
    // Leave data as null when TMDB returns a non-JSON response.
  }

  if (!response.ok) {
    const details = data?.status_message || `TMDB request failed (${response.status})`;
    throw new Error(details);
  }

  return data;
}

const getTitle = (item) => item.title || item.name || "Untitled";
const getDate = (item) => item.release_date || item.first_air_date || "";
const getType = (item) => item.media_type || (item.first_air_date ? "tv" : "movie");
const getImage = (path) =>
  path
    ? CONFIG.TMDB_IMAGE_URL + path
    : "https://placehold.co/500x750/181818/ffffff?text=No+Image";

function createCard(item) {
  const mediaType = getType(item);
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.innerHTML = `
    <span class="badge">★ ${(Number(item.vote_average) || 0).toFixed(1)}</span>
    <img loading="lazy" src="${getImage(item.poster_path)}" alt="${getTitle(item)} poster">
    <div class="card-info">
      <h3>${getTitle(item)}</h3>
      <div class="meta">${mediaType === "tv" ? "TV Show" : "Movie"} · ${(getDate(item) || "").slice(0, 4) || "—"}</div>
    </div>
  `;

  const open = () => openDetails(item.id, mediaType);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") open();
  });

  return card;
}

function renderSection(name, items) {
  const filtered = items.filter(
    (item) => item && item.id && ["movie", "tv"].includes(getType(item))
  );

  const section = document.createElement("section");
  section.className = "section";
  section.innerHTML = `<h2>${name}</h2><div class="grid"></div>`;

  const grid = section.querySelector(".grid");
  filtered.forEach((item) => grid.appendChild(createCard(item)));
  content.appendChild(section);

  return filtered.length;
}

function renderHeroDots() {
  const dots = $("#heroDots");
  if (!dots) return;
  dots.innerHTML = heroItems.map((_, index) => `
    <button class="hero-dot${index === heroIndex ? " active" : ""}" data-hero-index="${index}" aria-label="Show featured title ${index + 1}"></button>
  `).join("");
  dots.querySelectorAll("[data-hero-index]").forEach((button) => {
    button.onclick = () => showHero(Number(button.dataset.heroIndex), true);
  });
}

function setHero(item) {
  featured = item;
  hero.classList.remove("hero-changing");
  void hero.offsetWidth;
  hero.classList.add("hero-changing");
  if (item.backdrop_path) {
    hero.style.backgroundImage = `url(${CONFIG.TMDB_BACKDROP_URL + item.backdrop_path})`;
  }
  $("#heroTitle").textContent = getTitle(item);
  $("#heroOverview").textContent = item.overview || "Discover this title on FlickStream.";
  $("#heroType").textContent = getType(item) === "tv" ? "FEATURED TV SERIES" : "FEATURED MOVIE";
  renderHeroDots();
}

function resetHeroTimer() {
  clearInterval(heroTimer);
  if (heroItems.length > 1) {
    heroTimer = setInterval(() => showHero(heroIndex + 1, false), 6500);
  }
}

function showHero(index, restartTimer = true) {
  if (!heroItems.length) return;
  heroIndex = (index + heroItems.length) % heroItems.length;
  setHero(heroItems[heroIndex]);
  if (restartTimer) resetHeroTimer();
}

function setupHeroCarousel(items) {
  heroItems = items.slice(0, 7);
  heroIndex = 0;
  if (heroItems.length) showHero(0, true);
  $("#heroPrev").style.display = heroItems.length > 1 ? "grid" : "none";
  $("#heroNext").style.display = heroItems.length > 1 ? "grid" : "none";
}

async function home() {
  hero.style.display = "flex";
  showMessage("Loading movies and TV shows...");

  const [trend, movies, tv, top, air] = await Promise.all([
    api("/trending/all/week"),
    api("/movie/popular"),
    api("/tv/popular"),
    api("/movie/top_rated"),
    api("/tv/on_the_air"),
  ]);

  content.innerHTML = "";
  const usable = trend.results.filter(
    (item) => ["movie", "tv"].includes(item.media_type) && item.backdrop_path
  );

  if (usable.length) setupHeroCarousel(usable);
  renderSection("Trending Now", usable);
  renderSection("Popular Movies", movies.results.map((x) => ({ ...x, media_type: "movie" })));
  renderSection("Popular TV Shows", tv.results.map((x) => ({ ...x, media_type: "tv" })));
  renderSection("Top Rated Movies", top.results.map((x) => ({ ...x, media_type: "movie" })));
  renderSection("TV On The Air", air.results.map((x) => ({ ...x, media_type: "tv" })));
}

async function listing(kind) {
  hero.style.display = "none";
  showMessage(kind === "movie" ? "Loading movies..." : "Loading TV shows...");

  const endpoints =
    kind === "movie"
      ? [
          ["Popular Movies", "/movie/popular"],
          ["Top Rated Movies", "/movie/top_rated"],
          ["Upcoming Movies", "/movie/upcoming"],
          ["Now Playing", "/movie/now_playing"],
        ]
      : [
          ["Popular TV Shows", "/tv/popular"],
          ["Top Rated TV Shows", "/tv/top_rated"],
          ["TV On The Air", "/tv/on_the_air"],
          ["Airing Today", "/tv/airing_today"],
        ];

  content.innerHTML = "";
  for (const [name, path] of endpoints) {
    const data = await api(path);
    renderSection(name, data.results.map((x) => ({ ...x, media_type: kind })));
  }
}

async function search(query) {
  hero.style.display = "none";
  showMessage(`Searching for “${query}”...`);

  try {
    const data = await api("/search/multi", {
      query,
      include_adult: false,
      page: 1,
    });

    const results = (data.results || [])
      .filter((item) => ["movie", "tv"].includes(item.media_type))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    content.innerHTML = "";
    if (!results.length) {
      showMessage(`No movie or TV show found for “${query}”. Try the original title or a shorter search.`);
      return;
    }

    renderSection(`Search results for “${query}”`, results);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error("Search failed:", error);
    showMessage(`Search failed: ${error.message}. Check your TMDB API key in config.js.`, true);
  }
}

function watchlist() {
  hero.style.display = "none";
  content.innerHTML = "";
  const items = JSON.parse(localStorage.getItem("Flickstream-watchlist") || "[]");
  items.length
    ? renderSection("My List", items)
    : showMessage("Your watchlist is empty.");
}

function toggleList(item) {
  const items = JSON.parse(localStorage.getItem("Flickstream-watchlist") || "[]");
  const index = items.findIndex((x) => x.id === item.id && getType(x) === getType(item));
  if (index >= 0) items.splice(index, 1);
  else items.push(item);
  localStorage.setItem("Flickstream-watchlist", JSON.stringify(items));
  return index < 0;
}

async function openDetails(id, kind) {
  modal.classList.remove("hidden");
  modalBody.innerHTML = '<div class="empty">Loading details...</div>';

  try {
    const details = await api(`/${kind}/${id}`, {
      append_to_response: "credits,videos,recommendations",
    });
    details.media_type = kind;

    const genres = (details.genres || [])
      .map((genre) => `<span class="chip">${genre.name}</span>`)
      .join("");

    modalBody.innerHTML = `
      <div class="detail-backdrop" style="background-image:url(${details.backdrop_path ? CONFIG.TMDB_BACKDROP_URL + details.backdrop_path : ""})"></div>
      <div class="detail-content">
        <h2>${getTitle(details)}</h2>
        <div class="meta">${(getDate(details) || "").slice(0, 4)} · ★ ${(Number(details.vote_average) || 0).toFixed(1)} ${details.runtime ? `· ${details.runtime} min` : ""}</div>
        <div class="chips">${genres}</div>
        <p>${details.overview || "No overview available."}</p>
        <button id="mainWatch" class="watch-btn">▶ ${kind === "tv" ? "Choose Episode" : "Watch Now"}</button>
        <button id="listBtn">+ My List</button>
        <div id="tvControls"></div>
      </div>
    `;

    $("#listBtn").onclick = () => {
      $("#listBtn").textContent = toggleList(details) ? "✓ Added" : "+ My List";
    };

    if (kind === "movie") {
      $("#mainWatch").onclick = () => {
        location.href = `watch.html?type=movie&id=${encodeURIComponent(id)}`;
      };
    } else {
      $("#mainWatch").style.display = "none";
      await renderSeasons(details);
    }
  } catch (error) {
    console.error("Details failed:", error);
    modalBody.innerHTML = `<div class="empty error">Could not load this title: ${error.message}</div>`;
  }
}

async function renderSeasons(show) {
  const box = $("#tvControls");
  const validSeasons = (show.seasons || []).filter(
    (season) => season.season_number > 0 && season.episode_count > 0
  );

  if (!validSeasons.length) {
    box.innerHTML = '<div class="empty">No playable seasons were found in TMDB.</div>';
    return;
  }

  box.innerHTML = `
    <div class="season-row">
      <label for="seasonSelect">Season</label>
      <select id="seasonSelect">
        ${validSeasons
          .map(
            (season) =>
              `<option value="${season.season_number}">${season.name} (${season.episode_count} episodes)</option>`
          )
          .join("")}
      </select>
    </div>
    <div id="episodes" class="episodes"></div>
  `;

  const loadEpisodes = async () => {
    const seasonNumber = Number($("#seasonSelect").value);
    const episodesBox = $("#episodes");
    episodesBox.innerHTML = '<div class="empty">Loading episodes...</div>';

    try {
      const seasonData = await api(`/tv/${show.id}/season/${seasonNumber}`);
      episodesBox.innerHTML = "";

      if (!seasonData.episodes?.length) {
        episodesBox.innerHTML = '<div class="empty">No episodes found for this season.</div>';
        return;
      }

      seasonData.episodes.forEach((episodeData) => {
        const row = document.createElement("div");
        row.className = "episode";
        row.innerHTML = `
          <span><b>E${episodeData.episode_number}</b> ${episodeData.name || "Episode"}</span>
          <button class="watch-btn">Play</button>
        `;

        row.querySelector("button").onclick = () => {
          const url = new URL("watch.html", location.href);
          url.searchParams.set("type", "tv");
          url.searchParams.set("id", String(show.id));
          url.searchParams.set("season", String(seasonNumber));
          url.searchParams.set("episode", String(episodeData.episode_number));
          url.searchParams.set("title", getTitle(show));
          location.href = url.href;
        };

        episodesBox.appendChild(row);
      });
    } catch (error) {
      episodesBox.innerHTML = `<div class="empty error">Could not load episodes: ${error.message}</div>`;
    }
  };

  $("#seasonSelect").onchange = loadEpisodes;
  await loadEpisodes();
}

$("#heroPrev").onclick = () => showHero(heroIndex - 1, true);
$("#heroNext").onclick = () => showHero(heroIndex + 1, true);
hero.addEventListener("mouseenter", () => clearInterval(heroTimer));
hero.addEventListener("mouseleave", resetHeroTimer);

document.addEventListener("keydown", (event) => {
  if (hero.style.display === "none" || !heroItems.length) return;
  if (event.key === "ArrowLeft" && !event.target.matches("input, select, textarea")) showHero(heroIndex - 1, true);
  if (event.key === "ArrowRight" && !event.target.matches("input, select, textarea")) showHero(heroIndex + 1, true);
});

document.querySelectorAll("[data-close]").forEach((element) => {
  element.onclick = () => modal.classList.add("hidden");
});

$("#heroInfo").onclick = () => featured && openDetails(featured.id, getType(featured));
$("#heroPlay").onclick = () => {
  if (!featured) return;
  if (getType(featured) === "movie") {
    location.href = `watch.html?type=movie&id=${encodeURIComponent(featured.id)}`;
  } else {
    openDetails(featured.id, "tv");
  }
};

searchInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  const query = searchInput.value.trim();
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  searchSuggestions.innerHTML = '<div class="suggestion-message">Searching...</div>';
  searchSuggestions.classList.remove("hidden");
  suggestionTimer = setTimeout(() => loadSearchSuggestions(query), 300);
});

searchInput.addEventListener("keydown", (event) => {
  const options = [...searchSuggestions.querySelectorAll(".search-suggestion")];
  if (!options.length || searchSuggestions.classList.contains("hidden")) return;
  const current = options.findIndex((item) => item.classList.contains("active"));
  if (event.key === "ArrowDown") {
    event.preventDefault();
    options.forEach((item) => item.classList.remove("active"));
    options[(current + 1) % options.length].classList.add("active");
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    options.forEach((item) => item.classList.remove("active"));
    options[(current <= 0 ? options.length : current) - 1].classList.add("active");
  } else if (event.key === "Enter" && current >= 0) {
    event.preventDefault();
    options[current].click();
  } else if (event.key === "Escape") {
    hideSuggestions();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-shell")) hideSuggestions();
});

$("#searchForm").onsubmit = (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  hideSuggestions();
  if (!query) {
    showMessage("Enter a movie or TV-show title to search.");
    return;
  }
  search(query);
};

document.querySelectorAll("[data-view]").forEach((button) => {
  button.onclick = async () => {
    const view = button.dataset.view;
    try {
      if (view === "home") await home();
      else if (view === "movies") await listing("movie");
      else if (view === "tv") await listing("tv");
      else watchlist();
    } catch (error) {
      console.error(error);
      showMessage(`${error.message}. Check your API key in config.js.`, true);
    }
  };
});

home().catch((error) => {
  console.error(error);
  showMessage(`${error.message}. Check your API key in config.js.`, true);
});
