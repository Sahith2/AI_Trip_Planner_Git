function useExample(text) {
  const box = document.getElementById("message");
  box.value = text;
  box.focus();
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const preferred = ["text", "content", "message", "summary", "description", "reason", "reasoning", "explanation", "name", "item", "title"];
    for (const key of preferred) if (value[key] !== undefined) {
      const text = plainText(value[key]);
      if (text) return text;
    }
    return Object.values(value).map(plainText).filter(Boolean).join(" ");
  }
  return String(value);
}

function findValue(data, keys) {
  if (data === null || data === undefined || typeof data !== "object") return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null && data[key] !== undefined) return data[key];
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const found = findValue(value, keys);
      if (found !== null && found !== undefined) return found;
    }
  }
  return null;
}

function extractResponseParts(response) {
  const parts = { text: [], reasoning: [] };
  const visit = value => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") { if (value.trim()) parts.text.push(value.trim()); return; }
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value !== "object") return;

    if (value.text) parts.text.push(plainText(value.text));
    else if (value.content) parts.text.push(plainText(value.content));

    for (const key of ["reasoning", "reason", "explanation", "decision_reason", "weather_reason"]) {
      if (value[key]) parts.reasoning.push(plainText(value[key]));
    }

    for (const [key, child] of Object.entries(value)) {
      if (["text", "content", "reasoning", "reason", "explanation", "decision_reason", "weather_reason"].includes(key)) continue;
      if (typeof child === "object") visit(child);
    }
  };
  visit(response);
  parts.text = [...new Set(parts.text.filter(Boolean))];
  parts.reasoning = [...new Set(parts.reasoning.filter(Boolean))];
  return parts;
}

function getCombinedText(response) {
  const parts = extractResponseParts(response);
  return parts.text.join("\n\n").trim() || plainText(response);
}

function cleanMarkdown(text) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "")
    .replace(/^\s*\|[- :|]+\|\s*$/gm, "")
    .replace(/^\s*\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .trim();
}

function inlineText(text) {
  return escapeHtml(text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim());
}

function parseSections(text) {
  const cleaned = cleanMarkdown(text);
  const lines = cleaned.split("\n").map(x => x.trim()).filter(Boolean);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^(#{1,4}\s+|\*\*.*\*\*$)/.test(line)) {
      const title = line.replace(/^#{1,4}\s+/, "").replace(/^\*\*/, "").replace(/\*\*$/, "").trim();
      if (/^(quick trip summary|suggested packing list|packing list|weather-smart tips|trip summary)$/i.test(title)) {
        current = { title, lines: [] }; sections.push(current); continue;
      }
      if (/^day\s*\d+/i.test(title) || /^\d+\s*[–-]/.test(title)) {
        current = { title, lines: [] }; sections.push(current); continue;
      }
    }
    if (!current) { current = { title: "Overview", lines: [] }; sections.push(current); }
    current.lines.push(line);
  }
  return sections;
}

function inferDestination(text, data) {
  const value = findValue(data, ["destination", "destination_name", "location", "city"]);
  if (value && typeof value !== "object") return String(value);
  const match = text.match(/(?:trip to|weekend trip to|in)\s+([A-Z][A-Za-z .'-]+?)(?:\s+with|\s+for|\s+and|[.!?,]|$)/i);
  if (match) return match[1].trim();
  const title = text.match(/\b(?:trip|adventure)\s+(?:to|in)?\s*([A-Z][A-Za-z .'-]{2,40})/);
  return title ? title[1].trim() : "—";
}

function updateTripSummary(data, text) {
  const destination = inferDestination(text, data);
  const duration = findValue(data, ["duration", "duration_days", "days", "trip_duration"]);
  const budget = findValue(data, ["budget", "estimated_cost", "trip_budget"]);
  const food = findValue(data, ["food_preference", "cuisine_preference", "food", "cuisine"]);
  const weather = findValue(data, ["weather_description", "weather_summary", "weather"]);

  document.getElementById("summaryDestination").textContent = destination;
  if (duration) document.getElementById("summaryDuration").textContent = typeof duration === "number" ? `${duration} days` : plainText(duration);
  else {
    const m = text.match(/\b(\d+)\s*[- ]?day\b/i);
    document.getElementById("summaryDuration").textContent = m ? `${m[1]} days` : "—";
  }
  document.getElementById("summaryBudget").textContent = budget ? (typeof budget === "number" ? `$${budget}` : plainText(budget)) : "—";
  document.getElementById("summaryFood").textContent = food ? (typeof food === "object" ? "Personalized" : plainText(food)) : inferFood(text);
  document.getElementById("summaryWeather").textContent = weather ? (typeof weather === "object" ? "Forecast included" : plainText(weather).slice(0, 50)) : inferWeatherSummary(text);
}

function inferFood(text) {
  const m = text.match(/\b(Indian|Thai|Italian|Mexican|seafood|vegetarian|vegan|local|Asian)\b/i);
  return m ? m[1] : "Personalized";
}

function inferWeatherSummary(text) {
  const m = text.match(/(\d+%[^.\n]*rain|rain[^.\n]*\d+%|sunny|cloudy|overcast|showers)/i);
  return m ? m[0].slice(0, 50) : "Forecast included";
}

function weatherIcon(description) {
  const d = description.toLowerCase();
  if (d.includes("thunder")) return "⛈️";
  if (d.includes("rain") || d.includes("shower")) return "🌧️";
  if (d.includes("snow")) return "❄️";
  if (d.includes("cloud") || d.includes("overcast")) return "☁️";
  return "☀️";
}

function renderWeather(data, text) {
  const container = document.getElementById("weather");
  let weather = findValue(data, ["weather_snapshots", "forecast", "weather_data"]);
  if (!weather) weather = findValue(data, ["weather"]);

  if (Array.isArray(weather) && weather.length) {
    container.innerHTML = weather.map(day => {
      const date = day.forecast_date || day.date || "Forecast";
      const description = day.weather_description || day.description || "Weather information";
      const high = day.temperature_high ?? day.high;
      const low = day.temperature_low ?? day.low;
      const rain = day.precipitation_probability ?? day.rain_probability;
      return `<div class="weather-card">
        <div class="weather-date">${escapeHtml(date)}</div>
        <div class="weather-main"><span class="weather-icon">${weatherIcon(description)}</span><span class="weather-temp">${high !== undefined ? escapeHtml(high) + "°" : "—"}</span></div>
        <div class="weather-desc">${escapeHtml(description)}</div>
        <div class="weather-meta">
          ${low !== undefined ? `<span class="chip">Low ${escapeHtml(low)}°</span>` : ""}
          ${rain !== undefined ? `<span class="chip">Rain ${escapeHtml(rain)}%</span>` : ""}
        </div>
      </div>`;
    }).join("");
    return;
  }

  const snippets = [...text.matchAll(/(?:Day\s*\d+[^\n]*|\d+\s+Aug[^\n]*).*?(?:\d+%\s*(?:chance of )?rain|\d+%\s*precipitation)[^\n]*/gi)].map(m => m[0]);
  if (snippets.length) {
    container.innerHTML = snippets.map((s, i) => `<div class="weather-card"><div class="weather-date">Forecast ${i + 1}</div><div class="weather-main"><span class="weather-icon">🌦️</span></div><div class="weather-desc">${inlineText(s)}</div></div>`).join("");
    return;
  }
  container.innerHTML = `<div class="weather-card"><div class="weather-date">Trip conditions</div><div class="weather-main"><span class="weather-icon">🌤️</span></div><div class="weather-desc">Weather details were considered in the plan.</div></div>`;
}

function splitListItems(text) {
  return text
    .split(/\n|•|\s*;\s*/)
    .map(s => s.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(s => s.length > 2);
}

function renderFood(data, text) {
  const container = document.getElementById("foodPlanner");
  const food = findValue(data, ["food_plan", "food_planner", "restaurants", "restaurant_recommendations", "cuisine"]);

  if (Array.isArray(food) && food.length) {
    container.innerHTML = food.slice(0, 8).map((item, i) => {
      const name = plainText(item.name || item.restaurant || item.title || item.item || item);
      const reason = plainText(item.reason || item.description || item.notes || "Good fit for the trip.");
      return `<div class="food-card"><div class="meal-label">${i % 3 === 0 ? "Breakfast" : i % 3 === 1 ? "Lunch" : "Dinner"}</div><div class="food-name">${escapeHtml(name)}</div><div class="food-reason">${escapeHtml(reason)}</div></div>`;
    }).join("");
    return;
  }

  const lines = text.split("\n").filter(line => /breakfast|lunch|dinner|food highlights|restaurant|cafe|café/i.test(line));
  const candidates = [];
  for (const line of lines) {
    const clean = line.replace(/^\|+|\|+$/g, "").trim();
    const matches = clean.match(/(?:Breakfast|Lunch|Dinner)[^|\n]*/gi) || [];
    matches.forEach(m => candidates.push(m.trim()));
  }
  const unique = [...new Set(candidates)].slice(0, 6);
  if (unique.length) {
    container.innerHTML = unique.map(item => {
      const meal = (item.match(/^(Breakfast|Lunch|Dinner)/i) || ["Food"])[1];
      const detail = item.replace(/^(Breakfast|Lunch|Dinner)\s*(?:at|:|-)?\s*/i, "");
      return `<div class="food-card"><div class="meal-label">${escapeHtml(meal)}</div><div class="food-name">${escapeHtml(detail.split(/[–-]/)[0].trim())}</div><div class="food-reason">${escapeHtml(detail)}</div></div>`;
    }).join("");
    return;
  }
  container.innerHTML = `<div class="food-card"><div class="meal-label">Personalized</div><div class="food-name">Local dining recommendations</div><div class="food-reason">Food suggestions were incorporated into your itinerary.</div></div>`;
}

function renderPacking(data, text) {
  const container = document.getElementById("packingList");
  const packing = findValue(data, ["packing_items", "packing_list", "packing"]);
  let items = [];

  if (Array.isArray(packing)) items = packing.map(x => plainText(x.item || x.name || x.description || x));
  if (!items.length) {
    const section = text.match(/(?:Suggested Packing List|Packing List|Packing recommendations)[\s\S]*?(?=\n\n|$)/i);
    if (section) items = splitListItems(section[0].replace(/Suggested Packing List.*?\n/i, ""));
  }
  if (!items.length) {
    items = ["Lightweight breathable clothing", "Comfortable walking shoes", "Sunscreen", "Hat and sunglasses", "Reusable water bottle", "Rain layer or compact umbrella", "Portable charger"];
  }

  container.innerHTML = `<div class="packing-card"><ul class="packing-list">${[...new Set(items)].slice(0, 16).map(item => `<li><span class="check">✓</span><span>${escapeHtml(item)}</span></li>`).join("")}</ul></div>`;
}

function renderReason(data, response) {
  const container = document.getElementById("aiReason");
  const parts = extractResponseParts(response);
  const direct = findValue(data, ["reason", "reasoning", "explanation", "weather_reason", "decision_reason"]);
  const raw = direct ? plainText(direct) : parts.reasoning.join(" ");
  let items = splitReasoning(raw);

  if (!items.length) {
    const text = getCombinedText(response);
    items = [
      "Activities were selected to match the trip preferences and destination.",
      /rain|shower|weather|temperature|forecast/i.test(text) ? "Outdoor activities were arranged with weather conditions in mind." : "The plan balances sightseeing, downtime and practical travel flow.",
      /food|restaurant|cafe|café|dinner|lunch/i.test(text) ? "Food suggestions were included alongside the day's activities." : "Recommendations are designed to keep the itinerary practical and enjoyable."
    ];
  }

  container.innerHTML = `<div class="reason-box"><ul class="reason-list">${items.slice(0, 6).map(x => `<li>${inlineText(x)}</li>`).join("")}</ul></div>`;
}

function splitReasoning(raw) {
  if (!raw) return [];
  return raw.split(/\n\s*\n|(?<=\.)\s+(?=[A-Z])/).map(x => x.replace(/^[-*]\s*/, "").trim()).filter(x => x.length > 15);
}

function renderItinerary(text, data) {
  const container = document.getElementById("itinerary");
  let source = text.replace(/<br\s*\/?>/gi, "\n");
  const dayMatches = [...source.matchAll(/(?:^|\n)\s*(?:\*\*)?Day\s*(\d+)(?:\s*[–-]\s*|\s*:\s*)(.*?)(?=(?:\n\s*(?:\*\*)?Day\s*\d+)|$)/gis)];

  if (!dayMatches.length) {
    const numbered = [...source.matchAll(/(?:^|\n)\s*(?:\|\s*)?(\d+)\s*[–-]\s*([^\n|]+)([\s\S]*?)(?=(?:\n\s*\|?\s*\d+\s*[–-])|$)/g)];
    if (numbered.length) return renderDayMatches(numbered.map(m => ({ day: m[1], title: m[2], body: m[3] })));
  } else {
    return renderDayMatches(dayMatches.map(m => ({ day: m[1], title: m[2].trim(), body: m[0].replace(m[1], "").replace(/^.*?\n?/, "") + "" })));
  }

  const tableRows = source.split("\n").filter(line => line.includes("|") && !/^\s*\|?\s*[-:|]+\s*\|?\s*$/.test(line));
  if (tableRows.length > 1) {
    const rows = tableRows.slice(1).map(line => line.split("|").map(x => x.trim()).filter(Boolean));
    if (rows.length) {
      const cards = rows.map((r, i) => `<div class="day-card"><div class="day-header"><div class="day-number">${i + 1}</div><div><div class="day-title">${inlineText(r[0] || `Day ${i + 1}`)}</div><div class="day-subtitle">${inlineText(r.slice(1).join(" · ").slice(0, 100))}</div></div></div><div class="timeline">${r.slice(1).map((x,j) => `<div class="timeline-item"><div class="timeline-time">${j === 0 ? "Morning" : j === 1 ? "Midday" : j === 2 ? "Afternoon" : "Evening"}</div><div class="timeline-desc">${inlineText(x)}</div></div>`).join("")}</div></div>`).join("");
      container.innerHTML = cards;
      return;
    }
  }

  const bullets = source.split("\n").filter(x => /^[-*•]/.test(x));
  if (bullets.length) {
    container.innerHTML = `<div class="day-card"><div class="day-header"><div class="day-number">✓</div><div><div class="day-title">Your plan</div><div class="day-subtitle">Highlights from the generated itinerary</div></div></div><div class="timeline">${bullets.map((x,i)=>`<div class="timeline-item"><div class="timeline-time">${i+1}</div><div class="timeline-desc">${inlineText(x.replace(/^[-*•]\s*/, ""))}</div></div>`).join("")}</div></div>`;
    return;
  }

  container.innerHTML = `<div class="day-card"><div class="day-header"><div class="day-number">✦</div><div><div class="day-title">Personalized itinerary</div><div class="day-subtitle">Your plan is ready</div></div></div><div class="timeline"><div class="timeline-item"><div class="timeline-desc">${inlineText(source.slice(0, 1800))}</div></div></div></div>`;
}

function renderDayMatches(days) {
  const container = document.getElementById("itinerary");
  container.innerHTML = days.map((d, index) => {
    let body = cleanMarkdown(d.body || "");
    body = body.replace(/^\s*\|\s*/, "");
    const pieces = body.split(/\||\n/).map(x => x.trim()).filter(Boolean);
    const activityPieces = pieces.filter(x => !/^[-:]+$/.test(x));
    return `<div class="day-card"><div class="day-header"><div class="day-number">${escapeHtml(d.day || index + 1)}</div><div><div class="day-title">${inlineText(d.title || `Day ${index + 1}`)}</div><div class="day-subtitle">Personalized activities and food</div></div></div><div class="timeline">${(activityPieces.length ? activityPieces : [body]).slice(0, 8).map((x,j)=>`<div class="timeline-item"><div class="timeline-time">${j === 0 ? "Morning" : j === 1 ? "Midday" : j === 2 ? "Afternoon" : "Evening"}</div><div class="timeline-desc">${inlineText(x.replace(/^\*\*|\*\*$/g, ""))}</div></div>`).join("")}</div></div>`;
  }).join("");
}

function resetResults() {
  document.getElementById("summaryDestination").textContent = "—";
  document.getElementById("summaryDuration").textContent = "—";
  document.getElementById("summaryWeather").textContent = "—";
  document.getElementById("summaryBudget").textContent = "—";
  document.getElementById("summaryFood").textContent = "—";
}

async function sendMessage() {
  const messageBox = document.getElementById("message");
  const button = document.getElementById("planButton");
  const message = messageBox.value.trim();
  if (!message) {
    messageBox.focus();
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> Planning your trip…';
  resetResults();
  document.getElementById("itinerary").innerHTML = '<div class="loading"><span class="spinner"></span> Building your itinerary…</div>';
  document.getElementById("weather").innerHTML = '<div class="loading"><span class="spinner"></span> Checking destination conditions…</div>';
  document.getElementById("foodPlanner").innerHTML = '<div class="loading"><span class="spinner"></span> Finding food ideas…</div>';
  document.getElementById("packingList").innerHTML = '<div class="loading"><span class="spinner"></span> Preparing your packing list…</div>';
  document.getElementById("aiReason").innerHTML = '<div class="loading"><span class="spinner"></span> Explaining the plan…</div>';

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");

    const responseValue = data.response ?? data;
    const text = getCombinedText(responseValue);

    updateTripSummary(data, text);
    renderItinerary(text, data);
    renderWeather(data, text);
    renderFood(data, text);
    renderPacking(data, text);
    renderReason(data, responseValue);

    document.getElementById("tripSummaryCard").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Trip planner error:", error);
    const errorHtml = `<div class="error"><strong>We couldn't build the trip.</strong><br><small>${escapeHtml(error.message)}</small></div>`;
    document.getElementById("itinerary").innerHTML = errorHtml;
    document.getElementById("weather").innerHTML = errorHtml;
    document.getElementById("foodPlanner").innerHTML = errorHtml;
    document.getElementById("packingList").innerHTML = errorHtml;
    document.getElementById("aiReason").innerHTML = errorHtml;
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>✨</span> Plan my trip";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("message");
  if (!box) return;
  box.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      sendMessage();
    }
  });
});
