/* ============================================================
   AI TRIP & OUTDOOR ACTIVITY PLANNER
   Clean UI renderer
   ============================================================ */


/* ============================================================
   EXAMPLE PROMPTS
   ============================================================ */

function useExample(text) {
  const box = document.getElementById("message");
  if (!box) return;
  box.value = text;
  box.focus();
}


/* ============================================================
   SAFE HTML
   ============================================================ */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* ============================================================
   CONVERT ANY VALUE TO CLEAN TEXT
   Prevents [object Object]
   ============================================================ */

function plainText(value) {
  if (value === null || value === undefined) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(plainText).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    const preferred = [
      "text", "content", "message", "summary", "description",
      "reason", "reasoning", "explanation", "name", "item", "title"
    ];

    for (const key of preferred) {
      if (value[key] !== undefined) {
        const text = plainText(value[key]);
        if (text) return text;
      }
    }

    return Object.values(value).map(plainText).filter(Boolean).join(" ");
  }

  return String(value);
}


/* ============================================================
   FIND VALUE RECURSIVELY
   ============================================================ */

function findValue(data, keys) {
  if (data === null || data === undefined || typeof data !== "object") {
    return null;
  }

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(data, key) &&
      data[key] !== null &&
      data[key] !== undefined
    ) {
      return data[key];
    }
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const found = findValue(value, keys);
      if (found !== null && found !== undefined) return found;
    }
  }

  return null;
}


/* ============================================================
   EXTRACT RESPONSE CONTENT
   ============================================================ */

function extractResponseParts(response) {
  const parts = { text: [], reasoning: [] };

  const visit = value => {
    if (value === null || value === undefined) return;

    if (typeof value === "string") {
      if (value.trim()) parts.text.push(value.trim());
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== "object") return;

    if (value.text) {
      parts.text.push(plainText(value.text));
    } else if (value.content) {
      parts.text.push(plainText(value.content));
    }

    for (const key of ["reasoning", "reason", "explanation", "decision_reason", "weather_reason"]) {
      if (value[key]) parts.reasoning.push(plainText(value[key]));
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        ["text", "content", "reasoning", "reason", "explanation", "decision_reason", "weather_reason"]
          .includes(key)
      ) {
        continue;
      }
      if (child && typeof child === "object") visit(child);
    }
  };

  visit(response);

  parts.text = [...new Set(parts.text.filter(Boolean))];
  parts.reasoning = [...new Set(parts.reasoning.filter(Boolean))];

  return parts;
}


/* ============================================================
   COMBINED AI TEXT
   ============================================================ */

function getCombinedText(response) {
  const arr = Array.isArray(response) ? response : (response?.response ?? response);

  if (Array.isArray(arr)) {
    const textBlock = arr.find(b => b && b.type === "text" && typeof b.text === "string");
    if (textBlock) return textBlock.text;
  }

  return plainText(response);
}


/* ============================================================
   MARKDOWN CLEANUP
   ============================================================ */

function cleanMarkdown(text) {
  if (text === null || text === undefined) return "";

  return String(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


/* ============================================================
   INLINE TEXT
   ============================================================ */

function inlineText(text) {
  return escapeHtml(
    String(text || "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/<br\s*\/?>/gi, " ")
      .trim()
  );
}


/* ============================================================
   MARKDOWN TABLE PARSER
   ============================================================ */

function parseMarkdownTables(md) {
  const tables = [];
  const lines = String(md || "").split("\n");
  let current = null;

  const isSeparatorRow = cells =>
    cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c.trim()));

  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      if (isSeparatorRow(cells)) continue; // separator row, any column count
      if (!current) current = [];
      current.push(cells);
    } else if (current) {
      tables.push(current);
      current = null;
    }
  }

  if (current) tables.push(current);
  return tables; // array of tables, each an array of rows, each row an array of cell strings
}


/* ============================================================
   DESTINATION FALLBACK (from free text, when no summary table)
   ============================================================ */

function inferDestinationFallback(text) {
  const match = String(text || "").match(
    /(?:trip to|weekend trip to|getaway to|in)\s+([A-Z][A-Za-z .'-]+?)(?:\s+with|\s+for|\s+and|[.,!?]|$)/
  );
  return match ? match[1].trim() : null;
}


/* ============================================================
   SUMMARY FIELD LOOKUP (from markdown tables)
   ============================================================ */

function getSummaryField(text, label) {
  const tables = parseMarkdownTables(text);

  for (const table of tables) {
    for (const row of table) {
      if (row[0] && new RegExp(label, "i").test(row[0]) && row[1]) {
        return cleanMarkdown(row[1]);
      }
    }
  }

  return null;
}


/* ============================================================
   FOOD INFERENCE
   ============================================================ */

function inferFood(text) {
  const match = text.match(/\b(Indian|Thai|Italian|Mexican|seafood|vegetarian|vegan|local|Asian)\b/i);
  return match ? match[1] : "Personalized";
}


/* ============================================================
   WEATHER ICON
   ============================================================ */

function weatherIcon(description) {
  const d = String(description || "").toLowerCase();

  if (d.includes("thunder")) return "⛈️";
  if (d.includes("rain") || d.includes("shower")) return "🌧️";
  if (d.includes("snow")) return "❄️";
  if (d.includes("cloud") || d.includes("overcast")) return "☁️";

  return "☀️";
}


/* ============================================================
   TRIP SUMMARY
   ============================================================ */

function updateTripSummary(data, text) {
  const tables = parseMarkdownTables(text);
  const dayTable = tables.find(t => t[0] && /day/i.test(t[0][0]) && t.length > 1);

  const destination =
    getSummaryField(text, "destination") ||
    inferDestinationFallback(text) ||
    "—";

  let dates = getSummaryField(text, "dates");

  let weather = getSummaryField(text, "weather");
  if (!weather && dayTable) {
    const header = dayTable[0];
    const weatherCol = header.findIndex(h => /weather/i.test(h));
    if (weatherCol !== -1 && dayTable[1] && dayTable[1][weatherCol]) {
      weather = cleanMarkdown(dayTable[1][weatherCol]);
    }
  }

  const budget = findValue(data, ["budget", "estimated_cost", "trip_budget"]);
  const food = findValue(data, ["food_preference", "cuisine_preference", "food", "cuisine"]);

  const destEl = document.getElementById("summaryDestination");
  if (destEl) destEl.textContent = destination;

  const durationEl = document.getElementById("summaryDuration");
  if (durationEl) {
    if (dates) {
      durationEl.textContent = dates;
    } else {
      const match = text.match(/\b(\d+)\s*[- ]?day\b/i);
      if (match) {
        durationEl.textContent = `${match[1]} days`;
      } else if (dayTable) {
        durationEl.textContent = `${dayTable.length - 1} days`;
      } else {
        durationEl.textContent = "—";
      }
    }
  }

  const budgetEl = document.getElementById("summaryBudget");
  if (budgetEl) {
    budgetEl.textContent = budget
      ? (typeof budget === "number" ? `$${budget}` : plainText(budget))
      : "—";
  }

  const foodEl = document.getElementById("summaryFood");
  if (foodEl) {
    foodEl.textContent = food
      ? (typeof food === "object" ? "Personalized" : plainText(food))
      : inferFood(text);
  }

  const weatherEl = document.getElementById("summaryWeather");
  if (weatherEl) {
    weatherEl.textContent = weather ? weather.slice(0, 60) : "—";
  }
}


/* ============================================================
   WEATHER PANEL
   ============================================================ */

function renderWeather(data, text) {
  const container = document.getElementById("weather");
  if (!container) return;

  const structured = findValue(data, ["weather_snapshots", "forecast", "weather_data", "weather"]);

  if (Array.isArray(structured) && structured.length) {
    container.innerHTML =
      `<div class="weather-grid">` +
      structured.map(day => {
        const date = day.forecast_date || day.date || "Forecast";
        const description = day.weather_description || day.description || "Weather information";
        const high = day.temperature_high ?? day.high;
        const low = day.temperature_low ?? day.low;
        const rain = day.precipitation_probability ?? day.rain_probability;

        return `
          <div class="weather-card">
            <div class="weather-date">${escapeHtml(date)}</div>
            <div class="weather-main">
              <span class="weather-icon">${weatherIcon(description)}</span>
              <span class="weather-temp">${high !== undefined ? escapeHtml(high) + "°" : "—"}</span>
            </div>
            <div class="weather-desc">${escapeHtml(description)}</div>
            <div class="weather-meta">
              ${low !== undefined ? `<span class="chip">Low ${escapeHtml(low)}°</span>` : ""}
              ${rain !== undefined ? `<span class="chip">Rain ${escapeHtml(rain)}%</span>` : ""}
            </div>
          </div>
        `;
      }).join("") +
      `</div>`;
    return;
  }

  const weatherSummary = getSummaryField(text, "weather");

  if (weatherSummary) {
    container.innerHTML = `
      <div class="weather-card">
        <div class="weather-main">
          <span class="weather-icon">${weatherIcon(weatherSummary)}</span>
        </div>
        <div class="weather-date">Trip conditions</div>
        <div class="weather-desc">${inlineText(weatherSummary)}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="weather-card weather-empty">
      <div class="weather-main"><span class="weather-icon">🌤️</span></div>
      <div class="weather-date">Trip conditions</div>
      <div class="weather-desc">Weather details were considered when building your plan.</div>
    </div>
  `;
}


/* ============================================================
   LIST HELPERS
   ============================================================ */

function splitListItems(text) {
  return String(text || "")
    .split(/\n|•|\s*;\s*/)
    .map(s => s.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(s => s.length > 2);
}


/* ============================================================
   FOOD
   ============================================================ */

function renderFood(data, text) {
  const container = document.getElementById("foodPlanner");
  if (!container) return;

  function cleanFoodText(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/?[^>]+>/g, " ")
      .replace(/\*\*/g, "")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  const food = findValue(data, ["food_plan", "food_planner", "restaurants", "restaurant_recommendations", "cuisine"]);

  if (Array.isArray(food) && food.length) {
    const cards = food.slice(0, 6).map((item, i) => {
      const name = cleanFoodText(
        typeof item === "object"
          ? (item.name || item.restaurant || item.title || item.item || "Food recommendation")
          : item
      );

      const reason = cleanFoodText(
        typeof item === "object"
          ? (item.reason || item.description || item.notes || "Good fit for the trip.")
          : ""
      );

      if (!name) return "";

      const meal = i % 3 === 0 ? "Breakfast" : i % 3 === 1 ? "Lunch" : "Dinner";

      return `
        <div class="food-card">
          <div class="meal-label">${escapeHtml(meal)}</div>
          <div class="food-name">${escapeHtml(name)}</div>
          ${reason ? `<div class="food-reason">${escapeHtml(reason)}</div>` : ""}
        </div>
      `;
    }).filter(Boolean).join("");

    if (cards) {
      container.innerHTML = `<div class="food-grid">${cards}</div>`;
      return;
    }
  }

  // Try the markdown "Food Highlights" table
  const tables = parseMarkdownTables(text);
  const foodTable = tables.find(t => t[0] && /meal/i.test(t[0][0]));

  if (foodTable) {
    const rows = foodTable.slice(1);
    const cards = rows.map(row => {
      const meal = cleanFoodText(row[0] || "Food");
      const spot = cleanFoodText(row[1] || "");
      const signature = cleanFoodText(row[2] || "");

      return `
        <div class="food-card">
          <div class="meal-label">${escapeHtml(meal)}</div>
          <div class="food-name">${escapeHtml(spot)}</div>
          ${signature ? `<div class="food-reason">${escapeHtml(signature)}</div>` : ""}
        </div>
      `;
    }).join("");

    container.innerHTML = `<div class="food-grid">${cards}</div>`;
    return;
  }

  // Fallback: scan free text for Breakfast/Lunch/Dinner mentions
  const lines = String(text || "").split("\n").map(cleanFoodText).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    const matches = line.match(/(?:Breakfast|Lunch|Dinner)\s*(?:at|:|-)?\s*[^|]+/gi) || [];
    matches.forEach(match => {
      const cleaned = cleanFoodText(match);
      if (cleaned.length > 5 && cleaned.length < 180) candidates.push(cleaned);
    });
  }

  const unique = [...new Set(candidates)].slice(0, 6);

  if (!unique.length) {
    container.innerHTML = `<div class="empty-state">No food recommendations were found.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="food-grid">
      ${unique.map(item => {
        const mealMatch = item.match(/^(Breakfast|Lunch|Dinner)/i);
        const meal = mealMatch ? mealMatch[1] : "Food";
        const detail = item.replace(/^(Breakfast|Lunch|Dinner)\s*(?:at|:|-)?\s*/i, "").trim();

        return `
          <div class="food-card">
            <div class="meal-label">${escapeHtml(meal)}</div>
            <div class="food-name">${escapeHtml(detail.split(/[–—-]/)[0].trim())}</div>
            <div class="food-reason">${escapeHtml(detail)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


/* ============================================================
   PACKING
   ============================================================ */

function renderPacking(data, text) {
  const container = document.getElementById("packingList");
  if (!container) return;

  const packing = findValue(data, ["packing_items", "packing_list", "packing"]);
  let items = [];

  if (Array.isArray(packing)) {
    items = packing.map(x =>
      plainText(x && typeof x === "object" ? (x.item || x.name || x.description || x) : x)
    );
  }

  if (!items.length) {
    const tables = parseMarkdownTables(text);
    const packingTable = tables.find(t => t[0] && /category/i.test(t[0][0]));

    if (packingTable) {
      items = packingTable.slice(1)
        .map(row => cleanMarkdown(row[1] || ""))
        .filter(Boolean);
    }
  }

  if (!items.length) {
    const section = text.match(/(?:Suggested Packing List|Packing List|Packing recommendations)[\s\S]*?(?=\n\n|$)/i);
    if (section) {
      items = splitListItems(section[0].replace(/Suggested Packing List.*?\n/i, ""));
    }
  }

  if (!items.length) {
    items = [
      "Lightweight breathable clothing",
      "Comfortable walking shoes",
      "Sunscreen",
      "Hat and sunglasses",
      "Reusable water bottle",
      "Rain layer or compact umbrella",
      "Portable charger"
    ];
  }

  container.innerHTML = `
    <div class="packing-card">
      <div class="packing-grid">
        ${[...new Set(items)].slice(0, 16).map(item => `
          <div class="packing-item">
            <span class="check">✓</span>
            <span>${escapeHtml(item)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}


/* ============================================================
   AI PLANNING INSIGHTS
   ============================================================ */

function splitReasoning(raw) {
  if (!raw) return [];

  return String(raw)
    .split(/\n\s*\n|(?<=\.)\s+(?=[A-Z])/)
    .map(x => x.replace(/^[-*]\s*/, "").trim())
    .filter(x => x.length > 15 && x !== "[object Object]");
}

function renderReason(data, response) {
  const container = document.getElementById("aiReason");
  if (!container) return;

  const parts = extractResponseParts(response);

  const direct = findValue(data, ["reason", "reasoning", "explanation", "weather_reason", "decision_reason"]);

  let raw = direct ? plainText(direct) : parts.reasoning.join(" ");
  let items = splitReasoning(raw);

  if (!items.length) {
    const combinedText = getCombinedText(response);

    items = ["Activities were selected to match the destination and your trip preferences."];

    if (/rain|shower|weather|temperature|forecast/i.test(combinedText)) {
      items.push("Outdoor activities were arranged with the expected weather conditions in mind.");
    } else {
      items.push("The plan balances sightseeing, activities, downtime and practical travel flow.");
    }

    if (/food|restaurant|cafe|café|dinner|lunch/i.test(combinedText)) {
      items.push("Food recommendations were included alongside the day's activities.");
    }
  }

  container.innerHTML = `
    <div class="reason-box">
      <div class="reason-header">
        <div class="reason-icon">✨</div>
        <div>
          <div class="reason-title">Planning insights</div>
          <div class="reason-subtitle">Why these recommendations fit your trip</div>
        </div>
      </div>
      <div class="reason-list">
        ${items.slice(0, 5).map(item => `
          <div class="reason-item">
            <span class="reason-check">✓</span>
            <span>${inlineText(item)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}


/* ============================================================
   ITINERARY
   ============================================================ */

function renderItinerary(text, data) {
  const container = document.getElementById("itinerary");
  if (!container) return;

  const tables = parseMarkdownTables(text);
  const dayTable = tables.find(t => t[0] && /day/i.test(t[0][0]) && t.length > 1);

  if (!dayTable) {
    container.innerHTML = `
      <div class="day-card">
        <div class="day-header">
          <div class="day-number">1</div>
          <div>
            <div class="day-title">Your trip plan</div>
            <div class="day-subtitle">Personalized activities and food</div>
          </div>
        </div>
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-time">Day plan</div>
            <div class="timeline-desc">${inlineText(text)}</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const header = dayTable[0];
  const rows = dayTable.slice(1);

  container.innerHTML = rows.map((row, i) => {
    const day = cleanMarkdown(row[0] || `Day ${i + 1}`);

    const items = row.slice(1).map((cell, j) => `
      <div class="timeline-item">
        <div class="timeline-time">${escapeHtml(header[j + 1] || "Plan")}</div>
        <div class="timeline-desc">${inlineText(cleanMarkdown(cell))}</div>
      </div>
    `).join("");

    return `
      <div class="day-card">
        <div class="day-header">
          <div class="day-number">${i + 1}</div>
          <div>
            <div class="day-title">${inlineText(day)}</div>
            <div class="day-subtitle">Personalized activities and food</div>
          </div>
        </div>
        <div class="timeline">${items}</div>
      </div>
    `;
  }).join("");
}


/* ============================================================
   MAIN API CALL
   ============================================================ */

async function sendMessage() {
  const messageBox = document.getElementById("message");
  const button = document.getElementById("planButton");

  if (!messageBox || !button) return;

  const message = messageBox.value.trim();

  if (!message) {
    messageBox.focus();
    return;
  }

  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> Planning your trip…`;

  const itineraryEl = document.getElementById("itinerary");
  if (itineraryEl) itineraryEl.innerHTML = `<div class="loading"><span class="spinner"></span> Building your itinerary…</div>`;

  const weatherEl = document.getElementById("weather");
  if (weatherEl) weatherEl.innerHTML = `<div class="loading"><span class="spinner"></span> Checking destination conditions…</div>`;

  const foodEl = document.getElementById("foodPlanner");
  if (foodEl) foodEl.innerHTML = `<div class="loading"><span class="spinner"></span> Finding food ideas…</div>`;

  const packingEl = document.getElementById("packingList");
  if (packingEl) packingEl.innerHTML = `<div class="loading"><span class="spinner"></span> Preparing your packing list…</div>`;

  const reasonEl = document.getElementById("aiReason");
  if (reasonEl) reasonEl.innerHTML = `<div class="loading"><span class="spinner"></span> Preparing planning insights…</div>`;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    const responseValue = data.response ?? data;
    const text = getCombinedText(responseValue);

    updateTripSummary(data, text);
    renderItinerary(text, data);
    renderWeather(data, text);
    renderFood(data, text);
    renderPacking(data, text);
    renderReason(data, responseValue);

    const responseEl = document.getElementById("response");
    if (responseEl) {
      responseEl.innerHTML = `
        <div class="empty-state">
          <strong>Trip plan ready.</strong>
          <div>Scroll down to see your itinerary, weather, food and packing list.</div>
        </div>
      `;
    }

    const summaryCard = document.getElementById("tripSummaryCard");
    if (summaryCard) {
      summaryCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

  } catch (error) {
    console.error("Trip planner error:", error);

    const errorHtml = `
      <div class="error">
        <strong>We couldn't build the trip.</strong>
        <br>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;

    ["response", "itinerary", "weather", "foodPlanner", "packingList", "aiReason"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = errorHtml;
    });

  } finally {
    button.disabled = false;
    button.innerHTML = `<span>✨</span> Plan my trip`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("planButton");
  if (button) {
    button.addEventListener("click", sendMessage);
  }
});
