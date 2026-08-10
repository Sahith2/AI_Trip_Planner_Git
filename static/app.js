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
  if (value === null || value === undefined) {
    return "";
  }

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
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(plainText)
      .filter(Boolean)
      .join(" ");
  }

  if (typeof value === "object") {

    const preferred = [
      "text",
      "content",
      "message",
      "summary",
      "description",
      "reason",
      "reasoning",
      "explanation",
      "name",
      "item",
      "title"
    ];

    for (const key of preferred) {

      if (value[key] !== undefined) {

        const text = plainText(value[key]);

        if (text) {
          return text;
        }
      }
    }

    return Object.values(value)
      .map(plainText)
      .filter(Boolean)
      .join(" ");
  }

  return String(value);
}


/* ============================================================
   FIND VALUE RECURSIVELY
   ============================================================ */

function findValue(data, keys) {

  if (
    data === null ||
    data === undefined ||
    typeof data !== "object"
  ) {
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

      if (found !== null && found !== undefined) {
        return found;
      }
    }
  }

  return null;
}


/* ============================================================
   EXTRACT RESPONSE CONTENT
   ============================================================ */

function extractResponseParts(response) {

  const parts = {
    text: [],
    reasoning: []
  };

  const visit = value => {

    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "string") {

      if (value.trim()) {
        parts.text.push(value.trim());
      }

      return;
    }

    if (Array.isArray(value)) {

      value.forEach(visit);

      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (value.text) {
      parts.text.push(
        plainText(value.text)
      );
    }

    else if (value.content) {
      parts.text.push(
        plainText(value.content)
      );
    }

    for (
      const key of [
        "reasoning",
        "reason",
        "explanation",
        "decision_reason",
        "weather_reason"
      ]
    ) {

      if (value[key]) {

        parts.reasoning.push(
          plainText(value[key])
        );
      }
    }

    for (
      const [key, child]
      of Object.entries(value)
    ) {

      if (
        [
          "text",
          "content",
          "reasoning",
          "reason",
          "explanation",
          "decision_reason",
          "weather_reason"
        ].includes(key)
      ) {
        continue;
      }

      if (
        child &&
        typeof child === "object"
      ) {
        visit(child);
      }
    }
  };

  visit(response);

  parts.text = [
    ...new Set(
      parts.text.filter(Boolean)
    )
  ];

  parts.reasoning = [
    ...new Set(
      parts.reasoning.filter(Boolean)
    )
  ];

  return parts;
}


/* ============================================================
   COMBINED AI TEXT
   ============================================================ */

function getCombinedText(response) {

  const parts =
    extractResponseParts(response);

  const text =
    parts.text
      .filter(x => x && x !== "[object Object]")
      .join("\n\n")
      .trim();

  if (text) {
    return text;
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
   DESTINATION
   ============================================================ */

function inferDestination(text, data) {

  const value = findValue(
    data,
    [
      "destination",
      "destination_name",
      "location",
      "city"
    ]
  );

  if (
    value &&
    typeof value !== "object"
  ) {
    return String(value);
  }

  const match = text.match(
    /(?:trip to|weekend trip to|in)\s+([A-Z][A-Za-z .'-]+?)(?:\s+with|\s+for|\s+and|[.!?,]|$)/i
  );

  if (match) {
    return match[1].trim();
  }

  const title = text.match(
    /\b(?:trip|adventure)\s+(?:to|in)?\s*([A-Z][A-Za-z .'-]{2,40})/
  );

  return title
    ? title[1].trim()
    : "—";
}


/* ============================================================
   FOOD INFERENCE
   ============================================================ */

function inferFood(text) {

  const match = text.match(
    /\b(Indian|Thai|Italian|Mexican|seafood|vegetarian|vegan|local|Asian)\b/i
  );

  return match
    ? match[1]
    : "Personalized";
}


/* ============================================================
   WEATHER SUMMARY
   ============================================================ */

function inferWeatherSummary(text) {

  const match = text.match(
    /(\d+%[^.\n]*rain|rain[^.\n]*\d+%|sunny|cloudy|overcast|showers)/i
  );

  return match
    ? match[0].slice(0, 50)
    : "Forecast included";
}


/* ============================================================
   TRIP SUMMARY
   ============================================================ */

function updateTripSummary(data, text) {

  const destination =
    inferDestination(text, data);

  const duration =
    findValue(
      data,
      [
        "duration",
        "duration_days",
        "days",
        "trip_duration"
      ]
    );

  const budget =
    findValue(
      data,
      [
        "budget",
        "estimated_cost",
        "trip_budget"
      ]
    );

  const food =
    findValue(
      data,
      [
        "food_preference",
        "cuisine_preference",
        "food",
        "cuisine"
      ]
    );

  const weather =
    findValue(
      data,
      [
        "weather_description",
        "weather_summary",
        "weather"
      ]
    );


  document.getElementById(
    "summaryDestination"
  ).textContent = destination;


  if (duration) {

    document.getElementById(
      "summaryDuration"
    ).textContent =
      typeof duration === "number"
        ? `${duration} days`
        : plainText(duration);

  } else {

    const match =
      text.match(
        /\b(\d+)\s*[- ]?day\b/i
      );

    document.getElementById(
      "summaryDuration"
    ).textContent =
      match
        ? `${match[1]} days`
        : "—";
  }


  document.getElementById(
    "summaryBudget"
  ).textContent =
    budget
      ? (
          typeof budget === "number"
            ? `$${budget}`
            : plainText(budget)
        )
      : "—";


  document.getElementById(
    "summaryFood"
  ).textContent =
    food
      ? (
          typeof food === "object"
            ? "Personalized"
            : plainText(food)
        )
      : inferFood(text);


  document.getElementById(
    "summaryWeather"
  ).textContent =
    weather
      ? (
          typeof weather === "object"
            ? "Forecast included"
            : plainText(weather).slice(0, 50)
        )
      : inferWeatherSummary(text);
}


/* ============================================================
   WEATHER ICON
   ============================================================ */

function weatherIcon(description) {

  const d =
    String(description || "")
      .toLowerCase();

  if (d.includes("thunder")) {
    return "⛈️";
  }

  if (
    d.includes("rain") ||
    d.includes("shower")
  ) {
    return "🌧️";
  }

  if (d.includes("snow")) {
    return "❄️";
  }

  if (
    d.includes("cloud") ||
    d.includes("overcast")
  ) {
    return "☁️";
  }

  return "☀️";
}


/* ============================================================
   WEATHER
   ============================================================ */

function renderWeather(data, text) {

  const container =
    document.getElementById("weather");

  let weather =
    findValue(
      data,
      [
        "weather_snapshots",
        "forecast",
        "weather_data"
      ]
    );

  if (!weather) {

    weather =
      findValue(
        data,
        ["weather"]
      );
  }


  if (
    Array.isArray(weather) &&
    weather.length
  ) {

    container.innerHTML =
      `<div class="weather-grid">` +

      weather.map(day => {

        const date =
          day.forecast_date ||
          day.date ||
          "Forecast";

        const description =
          day.weather_description ||
          day.description ||
          "Weather information";

        const high =
          day.temperature_high ??
          day.high;

        const low =
          day.temperature_low ??
          day.low;

        const rain =
          day.precipitation_probability ??
          day.rain_probability;


        return `
          <div class="weather-card">

            <div class="weather-date">
              ${escapeHtml(date)}
            </div>

            <div class="weather-main">

              <span class="weather-icon">
                ${weatherIcon(description)}
              </span>

              <span class="weather-temp">
                ${
                  high !== undefined
                    ? escapeHtml(high) + "°"
                    : "—"
                }
              </span>

            </div>

            <div class="weather-desc">
              ${escapeHtml(description)}
            </div>

            <div class="weather-meta">

              ${
                low !== undefined
                  ? `
                    <span class="chip">
                      Low ${escapeHtml(low)}°
                    </span>
                  `
                  : ""
              }

              ${
                rain !== undefined
                  ? `
                    <span class="chip">
                      Rain ${escapeHtml(rain)}%
                    </span>
                  `
                  : ""
              }

            </div>

          </div>
        `;

      }).join("") +

      `</div>`;

    return;
  }


  const snippets =
    [
      ...text.matchAll(
        /(?:Day\s*\d+[^\n]*|\d+\s+Aug[^\n]*).*?(?:\d+%\s*(?:chance of )?rain|\d+%\s*precipitation)[^\n]*/gi
      )
    ]
      .map(m => m[0]);


  if (snippets.length) {

    container.innerHTML =
      `<div class="weather-grid">` +

      snippets.map(
        (s, i) => `
          <div class="weather-card">

            <div class="weather-date">
              Forecast ${i + 1}
            </div>

            <div class="weather-main">
              <span class="weather-icon">
                🌦️
              </span>
            </div>

            <div class="weather-desc">
              ${inlineText(s)}
            </div>

          </div>
        `
      ).join("") +

      `</div>`;

    return;
  }


  container.innerHTML = `
    <div class="weather-card weather-empty">

      <div class="weather-main">
        <span class="weather-icon">
          🌤️
        </span>
      </div>

      <div class="weather-date">
        Trip conditions
      </div>

      <div class="weather-desc">
        Weather details were considered
        when building your plan.
      </div>

    </div>
  `;
}


/* ============================================================
   LIST HELPERS
   ============================================================ */

function splitListItems(text) {

  return String(text || "")
    .split(/\n|•|\s*;\s*/)
    .map(
      s =>
        s
          .replace(/^[-*]\s*/, "")
          .replace(/\s+/g, " ")
          .trim()
    )
    .filter(
      s => s.length > 2
    );
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

  const food = findValue(data, [
    "food_plan",
    "food_planner",
    "restaurants",
    "restaurant_recommendations",
    "cuisine"
  ]);

  /* -----------------------------
     1. STRUCTURED FOOD DATA
  ----------------------------- */

  if (Array.isArray(food) && food.length) {
    const cards = food
      .slice(0, 6)
      .map((item, i) => {
        const name = cleanFoodText(
          typeof item === "object"
            ? (
                item.name ||
                item.restaurant ||
                item.title ||
                item.item ||
                "Food recommendation"
              )
            : item
        );

        const reason = cleanFoodText(
          typeof item === "object"
            ? (
                item.reason ||
                item.description ||
                item.notes ||
                "Good fit for the trip."
              )
            : ""
        );

        if (!name) return "";

        const meal =
          i % 3 === 0
            ? "Breakfast"
            : i % 3 === 1
              ? "Lunch"
              : "Dinner";

        return `
          <div class="food-card">
            <div class="meal-label">
              ${escapeHtml(meal)}
            </div>

            <div class="food-name">
              ${escapeHtml(name)}
            </div>

            ${
              reason
                ? `
                  <div class="food-reason">
                    ${escapeHtml(reason)}
                  </div>
                `
                : ""
            }
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    if (cards) {
      container.innerHTML = `<div class="food-grid">${cards}</div>`;
      return;
    }
  }

  /* -----------------------------
     2. FALLBACK: EXTRACT FOOD
        FROM AI RESPONSE
  ----------------------------- */

  const lines = String(text || "")
    .split("\n")
    .map(cleanFoodText)
    .filter(Boolean);

  const candidates = [];

  for (const line of lines) {
    const matches =
      line.match(
        /(?:Breakfast|Lunch|Dinner)\s*(?:at|:|-)?\s*[^|]+/gi
      ) || [];

    matches.forEach(match => {
      const cleaned = cleanFoodText(match);

      if (
        cleaned.length > 5 &&
        cleaned.length < 180
      ) {
        candidates.push(cleaned);
      }
    });
  }

  const unique = [
    ...new Set(candidates)
  ].slice(0, 6);

  if (!unique.length) {
    container.innerHTML = `
      <div class="empty-state">
        No food recommendations were found.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="food-grid">
      ${unique
        .map(item => {
          const mealMatch = item.match(
            /^(Breakfast|Lunch|Dinner)/i
          );

          const meal = mealMatch
            ? mealMatch[1]
            : "Food";

          const detail = item
            .replace(
              /^(Breakfast|Lunch|Dinner)\s*(?:at|:|-)?\s*/i,
              ""
            )
            .trim();

          return `
            <div class="food-card">

              <div class="meal-label">
                ${escapeHtml(meal)}
              </div>

              <div class="food-name">
                ${escapeHtml(
                  detail
                    .split(/[–—-]/)[0]
                    .trim()
                )}
              </div>

              <div class="food-reason">
                ${escapeHtml(detail)}
              </div>

            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

  /*
   * --------------------------------------------------
   * 4. NOTHING FOUND
   * --------------------------------------------------
   */

  container.innerHTML = `
    <div class="empty-state">
      No food recommendations were available for this trip.
    </div>
  `;
}


  container.innerHTML = `
    <div class="food-card">

      <div class="meal-label">
        Personalized
      </div>

      <div class="food-name">
        Local dining recommendations
      </div>

      <div class="food-reason">
        Food suggestions were incorporated
        into your itinerary.
      </div>

    </div>
  `;
}


/* ============================================================
   PACKING
   ============================================================ */

function renderPacking(data, text) {

  const container =
    document.getElementById(
      "packingList"
    );

  const packing =
    findValue(
      data,
      [
        "packing_items",
        "packing_list",
        "packing"
      ]
    );

  let items = [];


  if (Array.isArray(packing)) {

    items =
      packing.map(
        x =>
          plainText(
            x.item ||
            x.name ||
            x.description ||
            x
          )
      );
  }


  if (!items.length) {

    const section =
      text.match(
        /(?:Suggested Packing List|Packing List|Packing recommendations)[\s\S]*?(?=\n\n|$)/i
      );

    if (section) {

      items =
        splitListItems(
          section[0]
            .replace(
              /Suggested Packing List.*?\n/i,
              ""
            )
        );
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

        ${
          [
            ...new Set(items)
          ]
          .slice(0, 16)
          .map(
            item => `
              <div class="packing-item">

                <span class="check">
                  ✓
                </span>

                <span>
                  ${escapeHtml(item)}
                </span>

              </div>
            `
          )
          .join("")
        }

      </div>

    </div>
  `;
}


/* ============================================================
   AI PLANNING INSIGHTS
   ============================================================ */

function splitReasoning(raw) {

  if (!raw) {
    return [];
  }

  return String(raw)
    .split(
      /\n\s*\n|(?<=\.)\s+(?=[A-Z])/
    )
    .map(
      x =>
        x
          .replace(/^[-*]\s*/, "")
          .trim()
    )
    .filter(
      x =>
        x.length > 15 &&
        x !== "[object Object]"
    );
}


function renderReason(data, response) {

  const container =
    document.getElementById(
      "aiReason"
    );

  const parts =
    extractResponseParts(
      response
    );

  const direct =
    findValue(
      data,
      [
        "reason",
        "reasoning",
        "explanation",
        "weather_reason",
        "decision_reason"
      ]
    );


  let raw =
    direct
      ? plainText(direct)
      : parts.reasoning.join(" ");


  let items =
    splitReasoning(raw);


  /*
     Do not show raw internal model reasoning.
     If there is no clean explanation,
     create short user-facing explanations.
  */

  if (!items.length) {

    const text =
      getCombinedText(response);


    items = [
      "Activities were selected to match the destination and your trip preferences."
    ];


    if (
      /rain|shower|weather|temperature|forecast/i
        .test(text)
    ) {

      items.push(
        "Outdoor activities were arranged with the expected weather conditions in mind."
      );

    } else {

      items.push(
        "The plan balances sightseeing, activities, downtime and practical travel flow."
      );
    }


    if (
      /food|restaurant|cafe|café|dinner|lunch/i
        .test(text)
    ) {

      items.push(
        "Food recommendations were included alongside the day's activities."
      );
    }
  }


  container.innerHTML = `
    <div class="reason-box">

      <div class="reason-header">

        <div class="reason-icon">
          ✨
        </div>

        <div>

          <div class="reason-title">
            Planning insights
          </div>

          <div class="reason-subtitle">
            Why these recommendations fit your trip
          </div>

        </div>

      </div>


      <div class="reason-list">

        ${
          items
            .slice(0, 5)
            .map(
              item => `
                <div class="reason-item">

                  <span class="reason-check">
                    ✓
                  </span>

                  <span>
                    ${inlineText(item)}
                  </span>

                </div>
              `
            )
            .join("")
        }

      </div>

    </div>
  `;
}


/* ============================================================
   ITINERARY
   ============================================================ */

function renderItinerary(text, data) {

  const container =
    document.getElementById(
      "itinerary"
    );

  let source =
    String(text || "")
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      );


  /*
     Format:
     Day 1 – Something
     Day 2 – Something
  */

  const dayMatches =
    [
      ...source.matchAll(
        /(?:^|\n)\s*(?:\*\*)?Day\s*(\d+)(?:\s*[–-]\s*|\s*:\s*)(.*?)(?=(?:\n\s*(?:\*\*)?Day\s*\d+)|$)/gis
      )
    ];


  if (!dayMatches.length) {

    const numbered =
      [
        ...source.matchAll(
          /(?:^|\n)\s*(?:\|\s*)?(\d+)\s*[–-]\s*([^\n|]+)([\s\S]*?)(?=(?:\n\s*\|?\s*\d+\s*[–-])|$)/g
        )
      ];


    if (numbered.length) {

      return renderDayMatches(
        numbered.map(
          m => ({
            day: m[1],
            title: m[2],
            body: m[3]
          })
        )
      );
    }

  } else {

    return renderDayMatches(
      dayMatches.map(
        m => ({
          day: m[1],
          title: m[2].trim(),
          body: m[0]
            .replace(m[1], "")
            .replace(/^.*?\n?/, "")
        })
      )
    );
  }


  /*
     Markdown table fallback
  */

  const tableRows =
    source
      .split("\n")
      .filter(
        line =>
          line.includes("|") &&
          !/^\s*\|?\s*[-:|]+\s*\|?\s*$/.test(line)
      );


  if (tableRows.length > 1) {

    const rows =
      tableRows
        .slice(1)
        .map(
          line =>
            line
              .split("|")
              .map(x => x.trim())
              .filter(Boolean)
        );


    if (rows.length) {

      const cards =
        rows
          .map(
            (r, i) => `

              <div class="day-card">

                <div class="day-header">

                  <div class="day-number">
                    ${i + 1}
                  </div>

                  <div>

                    <div class="day-title">
                      ${inlineText(
                        r[0] ||
                        `Day ${i + 1}`
                      )}
                    </div>

                    <div class="day-subtitle">
                      ${inlineText(
                        r
                          .slice(1)
                          .join(" · ")
                          .slice(0, 120)
                      )}
                    </div>

                  </div>

                </div>


                <div class="timeline">

                  ${
                    r
                      .slice(1)
                      .map(
                        (x, j) => `

                          <div class="timeline-item">

                            <div class="timeline-time">
                              ${
                                j === 0
                                  ? "Morning"
                                  : j === 1
                                    ? "Midday"
                                    : j === 2
                                      ? "Afternoon"
                                      : "Evening"
                              }
                            </div>

                            <div class="timeline-desc">
                              ${inlineText(x)}
                            </div>

                          </div>

                        `
                      )
                      .join("")
                  }

                </div>

              </div>

            `
          )
          .join("");


      container.innerHTML =
        cards;

      return;
    }
  }


  /*
     Bullet fallback
  */

  const bullets =
    source
      .split("\n")
      .filter(
        x =>
          /^[-*•]/.test(x)
      );


  if (bullets.length) {

    container.innerHTML = `

      <div class="day-card">

        <div class="day-header">

          <div class="day-number">
            ✦
          </div>

          <div>

            <div class="day-title">
              Your personalized plan
            </div>

            <div class="day-subtitle">
              Trip highlights
            </div>

          </div>

        </div>


        <div class="timeline">

          ${
            bullets
              .map(
                (x, i) => `

                  <div class="timeline-item">

                    <div class="timeline-time">
                      ${i + 1}
                    </div>

                    <div class="timeline-desc">
                      ${inlineText(
                        x.replace(
                          /^[-*•]\s*/,
                          ""
                        )
                      )}
                    </div>

                  </div>

                `
              )
              .join("")
          }

        </div>

      </div>

    `;

    return;
  }


  /*
     Final fallback
  */

  container.innerHTML = `

    <div class="day-card">

      <div class="day-header">

        <div class="day-number">
          ✦
        </div>

        <div>

          <div class="day-title">
            Personalized itinerary
          </div>

          <div class="day-subtitle">
            Your plan is ready
          </div>

        </div>

      </div>


      <div class="timeline">

        <div class="timeline-item">

          <div class="timeline-desc">
            ${inlineText(
              source.slice(0, 3000)
            )}
          </div>

        </div>

      </div>

    </div>

  `;
}


/* ============================================================
   DAY MATCHES
   ============================================================ */

function renderDayMatches(days) {

  const container =
    document.getElementById(
      "itinerary"
    );


  container.innerHTML =
    days
      .map(
        (d, index) => {

          let body =
            cleanMarkdown(
              d.body || ""
            );


          body =
            body.replace(
              /^\s*\|\s*/,
              ""
            );


          const pieces =
            body
              .split(/\||\n/)
              .map(
                x => x.trim()
              )
              .filter(Boolean);


          const activityPieces =
            pieces.filter(
              x =>
                !/^[-:]+$/.test(x)
            );


          const activities =
            (
              activityPieces.length
                ? activityPieces
                : [body]
            )
            .slice(0, 8);


          return `

            <div class="day-card">

              <div class="day-header">

                <div class="day-number">
                  ${escapeHtml(
                    d.day ||
                    index + 1
                  )}
                </div>

                <div>

                  <div class="day-title">
                    ${inlineText(
                      d.title ||
                      `Day ${index + 1}`
                    )}
                  </div>

                  <div class="day-subtitle">
                    Personalized activities and food
                  </div>

                </div>

              </div>


              <div class="timeline">

                ${
                  activities
                    .map(
                      (x, j) => `

                        <div class="timeline-item">

                          <div class="timeline-time">
                            ${
                              j === 0
                                ? "Morning"
                                : j === 1
                                  ? "Midday"
                                  : j === 2
                                    ? "Afternoon"
                                    : "Evening"
                            }
                          </div>

                          <div class="timeline-desc">
                            ${inlineText(
                              x.replace(
                                /^\*\*|\*\*$/g,
                                ""
                              )
                            )}
                          </div>

                        </div>

                      `
                    )
                    .join("")
                }

              </div>

            </div>

          `;
        }
      )
      .join("");
}


/* ============================================================
   AI PLANNER STATUS
   Removes Agent Result 1 / Agent Result 2
   ============================================================ */

function renderPlannerStatus() {

  const container =
    document.getElementById(
      "response"
    );

  if (!container) {
    return;
  }


  container.innerHTML = `

    <div class="planner-status success">

      <div class="status-icon">
        ✓
      </div>

      <div>

        <div class="status-title">
          Your trip plan is ready
        </div>

        <div class="status-text">
          Your itinerary, weather, food and packing
          recommendations have been prepared.
        </div>

      </div>

    </div>

  `;
}


/* ============================================================
   RESET
   ============================================================ */

function resetResults() {

  const fields = [
    "summaryDestination",
    "summaryDuration",
    "summaryWeather",
    "summaryBudget",
    "summaryFood"
  ];


  fields.forEach(id => {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = "—";
    }

  });


  const response =
    document.getElementById(
      "response"
    );


  if (response) {

    response.innerHTML = `

      <div class="planner-status">

        <div class="status-icon loading-dot">
          ✦
        </div>

        <div>

          <div class="status-title">
            Planning your trip
          </div>

          <div class="status-text">
            Searching destinations, checking conditions
            and building your plan…
          </div>

        </div>

      </div>

    `;
  }
}


/* ============================================================
   MAIN API CALL
   ============================================================ */

async function sendMessage() {

  const messageBox =
    document.getElementById(
      "message"
    );

  const button =
    document.getElementById(
      "planButton"
    );


  if (!messageBox || !button) {
    return;
  }


  const message =
    messageBox.value.trim();


  if (!message) {

    messageBox.focus();

    return;
  }


  button.disabled = true;

  button.innerHTML = `
    <span class="spinner"></span>
    Planning your trip…
  `;


  resetResults();


  document.getElementById(
    "itinerary"
  ).innerHTML = `

    <div class="loading">

      <span class="spinner"></span>

      Building your itinerary…

    </div>

  `;


  document.getElementById(
    "weather"
  ).innerHTML = `

    <div class="loading">

      <span class="spinner"></span>

      Checking destination conditions…

    </div>

  `;


  document.getElementById(
    "foodPlanner"
  ).innerHTML = `

    <div class="loading">

      <span class="spinner"></span>

      Finding food ideas…

    </div>

  `;


  document.getElementById(
    "packingList"
  ).innerHTML = `

    <div class="loading">

      <span class="spinner"></span>

      Preparing your packing list…

    </div>

  `;


  document.getElementById(
    "aiReason"
  ).innerHTML = `

    <div class="loading">

      <span class="spinner"></span>

      Preparing planning insights…

    </div>

  `;


  try {

    const response =
      await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            message
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Request failed."
      );
    }


    const responseValue =
      data.response ?? data;


    const text =
      getCombinedText(
        responseValue
      );


    /*
       Update every visual section
    */

    updateTripSummary(
      data,
      text
    );


    renderItinerary(
      text,
      data
    );


    renderWeather(
      data,
      text
    );


    renderFood(
      data,
      text
    );


    renderPacking(
      data,
      text
    );


    renderReason(
      data,
      responseValue
    );


    /*
       Clean AI Planner card.
       No Agent Result 1.
       No Agent Result 2.
       No raw model output.
    */

    renderPlannerStatus();


    /*
       Scroll to the useful result,
       not the raw AI response.
    */

    const summaryCard =
      document.getElementById(
        "tripSummaryCard"
      );


    if (summaryCard) {

      summaryCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

  }


  catch (error) {

    console.error(
      "Trip planner error:",
      error
    );


    const errorHtml = `

      <div class="error">

        <strong>
          We couldn't build the trip.
        </strong>

        <br>

        <small>
          ${escapeHtml(
            error.message
          )}
        </small>

      </div>

    `;


    document.getElementById(
      "response"
    ).innerHTML = errorHtml;


    document.getElementById(
      "itinerary"
    ).innerHTML = errorHtml;


    document.getElementById(
      "weather"
    ).innerHTML = errorHtml;


    document.getElementById(
      "foodPlanner"
    ).innerHTML = errorHtml;


    document.getElementById(
      "packingList"
    ).innerHTML = errorHtml;


    document.getElementById(
      "aiReason"
    ).innerHTML = errorHtml;

  }


  finally {

    button.disabled = false;

    button.innerHTML = `
      <span>✨</span>
      Plan my trip
    `;
  }
}


/* ============================================================
   CTRL + ENTER
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const box =
      document.getElementById(
        "message"
      );


    if (!box) {
      return;
    }


    box.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          event.ctrlKey
        ) {

          event.preventDefault();

          sendMessage();
        }

      }
    );

  }
);
