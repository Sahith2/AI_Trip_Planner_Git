// Example prompts

function useExample(text) {
    const messageBox = document.getElementById("message");

    messageBox.value = text;
    messageBox.focus();
}


// HTML safety

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


// Format values

function formatValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string") {
        return escapeHtml(value).replace(/\n/g, "<br>");
    }

    if (typeof value === "number") {
        return escapeHtml(value);
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (Array.isArray(value)) {
        return value
            .map(item => {
                if (typeof item === "object" && item !== null) {
                    return `<li>${formatObject(item)}</li>`;
                }

                return `<li>${escapeHtml(item)}</li>`;
            })
            .join("");
    }

    if (typeof value === "object") {
        return formatObject(value);
    }

    return escapeHtml(value);
}


// Format objects

function formatObject(object) {
    if (object === null || object === undefined) {
        return "";
    }

    if (typeof object !== "object") {
        return escapeHtml(object);
    }

    return Object.entries(object)
        .map(([key, value]) => {
            const label = key
                .replace(/_/g, " ")
                .replace(/\b\w/g, character => character.toUpperCase());

            if (Array.isArray(value)) {
                return `
                    <div class="result-card">
                        <strong>${escapeHtml(label)}</strong>

                        <ul class="result-list">
                            ${value.map(item => {
                                if (
                                    typeof item === "object" &&
                                    item !== null
                                ) {
                                    return `<li>${formatObject(item)}</li>`;
                                }

                                return `<li>${escapeHtml(item)}</li>`;
                            }).join("")}
                        </ul>
                    </div>
                `;
            }

            if (typeof value === "object" && value !== null) {
                return `
                    <div class="result-card">
                        <strong>${escapeHtml(label)}</strong>
                        ${formatObject(value)}
                    </div>
                `;
            }

            return `
                <div class="result-card">
                    <strong>${escapeHtml(label)}:</strong>
                    ${formatValue(value)}
                </div>
            `;
        })
        .join("");
}


// Find values inside nested response

function findValue(data, possibleKeys) {
    if (data === null || data === undefined) {
        return null;
    }

    if (typeof data !== "object") {
        return null;
    }

    for (const key of possibleKeys) {
        if (
            Object.prototype.hasOwnProperty.call(data, key)
        ) {
            return data[key];
        }
    }

    for (const value of Object.values(data)) {
        if (
            typeof value === "object" &&
            value !== null
        ) {
            const result = findValue(value, possibleKeys);

            if (
                result !== null &&
                result !== undefined
            ) {
                return result;
            }
        }
    }

    return null;
}


// Trip summary

function updateTripSummary(data) {
    const destination = findValue(data, [
        "destination",
        "destination_name",
        "location",
        "city"
    ]);

    const duration = findValue(data, [
        "duration",
        "duration_days",
        "days",
        "trip_duration"
    ]);

    const weather = findValue(data, [
        "weather",
        "weather_description",
        "weather_summary"
    ]);

    const budget = findValue(data, [
        "budget",
        "estimated_cost",
        "trip_budget"
    ]);

    const food = findValue(data, [
        "food",
        "food_preference",
        "cuisine",
        "cuisine_preference"
    ]);

    const destinationElement =
        document.getElementById("summaryDestination");

    const durationElement =
        document.getElementById("summaryDuration");

    const weatherElement =
        document.getElementById("summaryWeather");

    const budgetElement =
        document.getElementById("summaryBudget");

    const foodElement =
        document.getElementById("summaryFood");

    if (destination) {
        destinationElement.textContent =
            typeof destination === "object"
                ? "See response"
                : destination;
    }

    if (duration) {
        durationElement.textContent =
            typeof duration === "number"
                ? `${duration} days`
                : duration;
    }

    if (weather) {
        weatherElement.textContent =
            typeof weather === "object"
                ? "Available"
                : weather;
    }

    if (budget) {
        budgetElement.textContent =
            typeof budget === "number"
                ? `$${budget}`
                : budget;
    }

    if (food) {
        foodElement.textContent =
            typeof food === "object"
                ? "Personalized"
                : food;
    }
}


// Weather

function renderWeather(data) {
    const container =
        document.getElementById("weather");

    const weather = findValue(data, [
        "weather_snapshots",
        "weather",
        "forecast",
        "weather_data"
    ]);

    if (!weather) {
        return;
    }

    if (!Array.isArray(weather)) {
        container.innerHTML = `
            <div class="weather-card">
                <strong>🌦️ Weather</strong>
                <p>${formatValue(weather)}</p>
            </div>
        `;

        return;
    }

    container.innerHTML = weather
        .map(day => {
            const date =
                day.forecast_date ||
                day.date ||
                "Forecast";

            const description =
                day.weather_description ||
                day.description ||
                "Weather information";

            const high = day.temperature_high;
            const low = day.temperature_low;
            const rain = day.precipitation_probability;

            return `
                <div class="weather-card">

                    <strong>
                        🌦️ ${escapeHtml(date)}
                    </strong>

                    <p>
                        ${escapeHtml(description)}
                    </p>

                    ${
                        high !== undefined
                            ? `
                                <div>
                                    🌡️ High:
                                    ${escapeHtml(high)}°
                                </div>
                              `
                            : ""
                    }

                    ${
                        low !== undefined
                            ? `
                                <div>
                                    🌡️ Low:
                                    ${escapeHtml(low)}°
                                </div>
                              `
                            : ""
                    }

                    ${
                        rain !== undefined
                            ? `
                                <div>
                                    🌧️ Rain:
                                    ${escapeHtml(rain)}%
                                </div>
                              `
                            : ""
                    }

                </div>
            `;
        })
        .join("");
}


// Food planner

function renderFood(data) {
    const container =
        document.getElementById("foodPlanner");

    const food = findValue(data, [
        "food",
        "food_plan",
        "food_planner",
        "restaurants",
        "restaurant_recommendations",
        "cuisine"
    ]);

    if (!food) {
        return;
    }

    container.innerHTML = `
        <div class="food-card">

            <strong>
                🍛 Personalized Food Plan
            </strong>

            <div>
                ${formatValue(food)}
            </div>

        </div>
    `;
}


// Packing list

function renderPacking(data) {
    const container =
        document.getElementById("packingList");

    const packing = findValue(data, [
        "packing_items",
        "packing_list",
        "packing"
    ]);

    if (!packing) {
        return;
    }

    if (!Array.isArray(packing)) {
        container.innerHTML = `
            <div class="packing-card">

                <strong>
                    🎒 Packing List
                </strong>

                <div>
                    ${formatValue(packing)}
                </div>

            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="packing-card">

            <strong>
                🎒 Smart Packing List
            </strong>

            <ul class="result-list">

                ${packing.map(item => {
                    const text =
                        typeof item === "object"
                            ? (
                                item.item ||
                                item.name ||
                                item.description ||
                                JSON.stringify(item)
                            )
                            : item;

                    const completed =
                        typeof item === "object" &&
                        item.completed;

                    return `
                        <li>
                            ${completed ? "☑️" : "⬜"}
                            ${escapeHtml(text)}
                        </li>
                    `;
                }).join("")}

            </ul>

        </div>
    `;
}


// AI reasoning

function renderReason(data) {
    const container =
        document.getElementById("aiReason");

    const reason = findValue(data, [
        "reason",
        "reasoning",
        "explanation",
        "weather_reason",
        "decision_reason"
    ]);

    if (!reason) {
        return;
    }

    container.innerHTML = `
        <div class="ai-reason">

            <div class="ai-reason-title">
                🤖 Why AI made these decisions
            </div>

            <div>
                ${formatValue(reason)}
            </div>

        </div>
    `;
}


// Main response renderer

function renderResponse(response) {
    if (response === null || response === undefined) {
        return `
            <div class="result-card">
                No response received.
            </div>
        `;
    }

    if (typeof response === "string") {
        return `
            <div class="result-card">
                ${escapeHtml(response).replace(/\n/g, "<br>")}
            </div>
        `;
    }

    if (Array.isArray(response)) {
        return response
            .map((item, index) => {
                return `
                    <div class="result-section">

                        <h3>
                            🤖 Agent Result ${index + 1}
                        </h3>

                        ${formatObject(item)}

                    </div>
                `;
            })
            .join("");
    }

    if (typeof response === "object") {
        return `
            <div class="result-section">
                ${formatObject(response)}
            </div>
        `;
    }

    return escapeHtml(response);
}


// Send message

async function sendMessage() {
    const messageBox =
        document.getElementById("message");

    const responseBox =
        document.getElementById("response");

    const button =
        document.getElementById("planButton");

    const message =
        messageBox.value.trim();

    if (!message) {
        responseBox.innerHTML = `
            <div class="error">
                Please enter a trip request.
            </div>
        `;

        messageBox.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "🤖 Planning...";

    responseBox.innerHTML = `
        <div class="loading">
            🤖 AI is planning your trip...
        </div>
    `;

    try {
        const response = await fetch(
            "/api/chat",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    message: message
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Request failed."
            );
        }

        responseBox.innerHTML =
            renderResponse(data.response);

        updateTripSummary(data);
        renderWeather(data);
        renderFood(data);
        renderPacking(data);
        renderReason(data);

        responseBox.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error(
            "Trip planner error:",
            error
        );

        responseBox.innerHTML = `
            <div class="error">

                <strong>
                    Something went wrong.
                </strong>

                <br><br>

                ${escapeHtml(error.message)}

            </div>
        `;

    } finally {
        button.disabled = false;
        button.textContent = "✨ Plan My Trip";
    }
}


// Ctrl + Enter support

document.addEventListener(
    "DOMContentLoaded",
    function () {
        const messageBox =
            document.getElementById("message");

        if (!messageBox) {
            return;
        }

        messageBox.addEventListener(
            "keydown",
            function (event) {
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
