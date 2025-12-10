// Open-Meteo APIs (No API Key required)
const GEOCODING_API = "https://nominatim.openstreetmap.org/search";
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
const healthTipsList = document.getElementById("health-tips-list");
const ecoTipsList = document.getElementById("eco-tips-list");

// Meter Elements
const pm25Meter = document.getElementById("pm25-meter");
const pm10Meter = document.getElementById("pm10-meter");
const o3Meter = document.getElementById("o3-meter");
const no2Meter = document.getElementById("no2-meter");

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
    // Using OpenStreetMap (Nominatim) for granular area search
    const response = await fetch(
      `${GEOCODING_API}?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&addressdetails=1`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      showSuggestions(data);
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

    // Format display name (Area, City, Country)
    const displayName = location.display_name; // Nominatim provides a full address string
    // Simplify for display if too long
    const parts = displayName.split(", ");
    const shortName =
      parts.length > 3
        ? `${parts[0]}, ${parts[1]}, ${parts[parts.length - 1]}`
        : displayName;

    div.textContent = shortName;
    div.onclick = () => {
      // Use the name of the place (e.g., "Sector 18") for the input
      const name = location.name || parts[0];
      cityInput.value = name;
      suggestionsList.classList.add("hidden");
      fetchAQI(location.lat, location.lon, name);
    };
    suggestionsList.appendChild(div);
  });
}

async function searchCity(cityName) {
  try {
    const response = await fetch(
      `${GEOCODING_API}?q=${encodeURIComponent(cityName)}&format=json&limit=1`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      const location = data[0];
      // Use the name found or the search query
      const name = location.name || cityName;
      fetchAQI(location.lat, location.lon, name);
    } else {
      showError("Location not found.");
    }
  } catch (err) {
    showError("Error searching for location.");
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
  updatePollutant(pm25El, pm25Meter, currentData.pm2_5, 250); // PM2.5 max ~250
  updatePollutant(pm10El, pm10Meter, currentData.pm10, 425); // PM10 max ~425
  updatePollutant(o3El, o3Meter, currentData.ozone, 400); // Ozone max ~400
  updatePollutant(no2El, no2Meter, currentData.nitrogen_dioxide, 400); // NO2 max ~400

  // Determine Status & Theme
  const status = getAQIStatus(aqi);

  aqiStatusEl.textContent = status.label;
  aqiImpEl.textContent = status.implication;

  // Update Theme Colors
  document.body.className = status.className;

  // Update Precautions
  updatePrecautions(aqi);

  // Show results
  resultContainer.classList.remove("hidden");
}

function updatePollutant(textEl, meterEl, value, maxValue) {
  if (value != null) {
    textEl.textContent = `${value} µg/m³`;
    // Calculate percentage, capped at 100%
    const percentage = Math.min((value / maxValue) * 100, 100);
    meterEl.style.left = `${percentage}%`;
  } else {
    textEl.textContent = "--";
    meterEl.style.left = "0%";
  }
}

function updatePrecautions(aqi) {
  const precautions = getPrecautions(aqi);

  // Clear previous lists
  healthTipsList.innerHTML = "";
  ecoTipsList.innerHTML = "";

  // Populate Health Tips
  precautions.health.forEach((tip) => {
    const li = document.createElement("li");
    li.textContent = tip;
    healthTipsList.appendChild(li);
  });

  // Populate Eco Tips
  precautions.eco.forEach((tip) => {
    const li = document.createElement("li");
    li.textContent = tip;
    ecoTipsList.appendChild(li);
  });
}

function getPrecautions(aqi) {
  if (aqi <= 50) {
    return {
      health: [
        "Air quality is great! Enjoy outdoor activities.",
        "Open windows to ventilate your home.",
        "Perfect time for exercise outside.",
      ],
      eco: [
        "Walk or bike instead of driving.",
        "Keep maintaining clean habits.",
        "Plant a tree or maintain your garden.",
      ],
    };
  } else if (aqi <= 100) {
    return {
      health: [
        "Sensitive individuals should limit prolonged outdoor exertion.",
        "Generally safe for most people to be outside.",
        "Monitor air quality if you have asthma.",
      ],
      eco: [
        "Carpool or use public transport.",
        "Conserve energy at home to reduce emissions.",
        "Keep your vehicle well-tuned.",
      ],
    };
  } else if (aqi <= 150) {
    return {
      health: [
        "Sensitive groups (kids, elderly) should reduce outdoor play.",
        "Wear a mask if you have respiratory issues.",
        "Take breaks during outdoor activities.",
      ],
      eco: [
        "Avoid burning wood or trash.",
        "Reduce car trips; combine errands.",
        "Refuel cars in the evening when it's cooler.",
      ],
    };
  } else if (aqi <= 200) {
    return {
      health: [
        "Everyone should reduce prolonged outdoor exertion.",
        "Wear a mask (N95/KN95) if you must be outside.",
        "Run an air purifier indoors if available.",
      ],
      eco: [
        "Strictly avoid any burning activities.",
        "Use public transit to reduce vehicle emissions.",
        "Delay using gas-powered lawn equipment.",
      ],
    };
  } else if (aqi <= 300) {
    return {
      health: [
        "Avoid outdoor activities completely.",
        "Keep windows closed to keep dirty air out.",
        "Sensitive groups should stay in a clean air room.",
      ],
      eco: [
        "Minimize energy consumption.",
        "Report illegal burning to local authorities.",
        "Avoid idling your vehicle.",
      ],
    };
  } else {
    return {
      health: [
        "Stay indoors completely; it's an emergency condition.",
        "Seal windows and doors with wet towels if needed.",
        "Seek medical help immediately if breathless.",
      ],
      eco: [
        "Do not use vehicles unless for an absolute emergency.",
        "Stop all non-essential energy use.",
        "Spread awareness about the emergency.",
      ],
    };
  }
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
