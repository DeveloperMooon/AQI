// Open-Meteo APIs (No API Key required)
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_API = "https://air-quality-api.open-meteo.com/v1/air-quality";

// DOM Elements
const searchBtn = document.getElementById("search-btn");
const cityInput = document.getElementById("city-input");
const locateBtn = document.getElementById("locate-btn");
const loader = document.getElementById("loader");
const errorMsg = document.getElementById("error-msg");
const resultContainer = document.getElementById("result-container");
const suggestionsList = document.getElementById("suggestions-list");

// UI Elements to update
const cityNameEl = document.getElementById("city-name");
const timeInfoEl = document.getElementById("time-info");
const aqiValueEl = document.getElementById("aqi-value");
const aqiStatusEl = document.getElementById("aqi-status-text");
const aqiImpEl = document.getElementById("aqi-implication");
const pm25El = document.getElementById("pm25");
const pm10El = document.getElementById("pm10");
const o3El = document.getElementById("o3");
const no2El = document.getElementById("no2");

let debounceTimer;

// Event Listeners
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (city) searchCity(city);
});

cityInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    suggestionsList.classList.add("hidden");
    return;
  }

  debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
});

// Hide suggestions when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-bar")) {
    suggestionsList.classList.add("hidden");
  }
});

locateBtn.addEventListener("click", handleGeolocation);

// Functions

async function fetchSuggestions(query) {
  try {
    const response = await fetch(
      `${GEOCODING_API}?name=${query}&count=5&language=en&format=json`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      showSuggestions(data.results);
    } else {
      suggestionsList.classList.add("hidden");
    }
  } catch (err) {
    console.error("Error fetching suggestions:", err);
  }
}

function showSuggestions(locations) {
  suggestionsList.innerHTML = "";
  suggestionsList.classList.remove("hidden");

  locations.forEach((location) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = `${location.name}, ${location.country}`;
    div.onclick = () => {
      cityInput.value = location.name;
      suggestionsList.classList.add("hidden");
      fetchAQI(location.latitude, location.longitude, location.name);
    };
    suggestionsList.appendChild(div);
  });
}

async function searchCity(cityName) {
  try {
    const response = await fetch(
      `${GEOCODING_API}?name=${cityName}&count=1&language=en&format=json`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const location = data.results[0];
      fetchAQI(location.latitude, location.longitude, location.name);
    } else {
      showError("City not found.");
    }
  } catch (err) {
    showError("Error searching for city.");
  }
}

function handleGeolocation() {
  if (navigator.geolocation) {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        // Reverse geocoding could be added here to get city name, but for now we'll use "Your Location"
        fetchAQI(lat, lon, "Your Location");
      },
      (error) => {
        showError("Unable to retrieve your location.");
        setLoading(false);
      }
    );
  } else {
    showError("Geolocation is not supported by your browser.");
  }
}

async function fetchAQI(lat, lon, cityName) {
  setLoading(true);
  errorMsg.classList.add("hidden");
  resultContainer.classList.add("hidden");

  try {
    const url = `${AIR_QUALITY_API}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.current) {
      updateUI(data.current, cityName);
    } else {
      showError("No air quality data available for this location.");
    }
  } catch (err) {
    showError("Failed to fetch AQI data.");
  } finally {
    setLoading(false);
  }
}

function updateUI(currentData, cityName) {
  const aqi = currentData.us_aqi;

  // Update Text Content
  cityNameEl.textContent = cityName;

  // Format time
  const date = new Date(currentData.time);
  timeInfoEl.textContent = `Last updated: ${date.toLocaleString()}`;

  aqiValueEl.textContent = aqi;

  // Pollutants
  pm25El.textContent = currentData.pm2_5 ? `${currentData.pm2_5} µg/m³` : "--";
  pm10El.textContent = currentData.pm10 ? `${currentData.pm10} µg/m³` : "--";
  o3El.textContent = currentData.ozone ? `${currentData.ozone} µg/m³` : "--";
  no2El.textContent = currentData.nitrogen_dioxide
    ? `${currentData.nitrogen_dioxide} µg/m³`
    : "--";

  // Determine Status & Theme
  const status = getAQIStatus(aqi);

  aqiStatusEl.textContent = status.label;
  aqiImpEl.textContent = status.implication;

  // Update Theme Colors
  document.body.className = status.className;

  // Show results
  resultContainer.classList.remove("hidden");
}

function getAQIStatus(aqi) {
  if (aqi == null)
    return { label: "Unknown", className: "", implication: "Data unavailable" };

  if (aqi <= 50) {
    return {
      label: "Good",
      className: "good",
      implication:
        "Air quality is satisfactory, and air pollution poses little or no risk.",
    };
  } else if (aqi <= 100) {
    return {
      label: "Moderate",
      className: "moderate",
      implication:
        "Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.",
    };
  } else if (aqi <= 150) {
    return {
      label: "Unhealthy for Sensitive Groups",
      className: "sensitive",
      implication:
        "Members of sensitive groups may experience health effects. The general public is less likely to be affected.",
    };
  } else if (aqi <= 200) {
    return {
      label: "Unhealthy",
      className: "unhealthy",
      implication:
        "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.",
    };
  } else if (aqi <= 300) {
    return {
      label: "Very Unhealthy",
      className: "very-unhealthy",
      implication:
        "Health alert: The risk of health effects is increased for everyone.",
    };
  } else {
    return {
      label: "Hazardous",
      className: "hazardous",
      implication:
        "Health warning of emergency conditions: everyone is more likely to be affected.",
    };
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    loader.classList.remove("hidden");
    resultContainer.classList.add("hidden");
  } else {
    loader.classList.add("hidden");
  }
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
  setLoading(false);
}
