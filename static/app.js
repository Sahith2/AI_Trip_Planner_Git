function useExample(text) {
    const messageBox = document.getElementById("message");

    if (messageBox) {
        messageBox.value = text;
        messageBox.focus();
    }
}

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

function getResponseItems(response) {
    if (!response) {
        return [];
    }

    if (Array.isArray(response)) {
        return response;
    }

    return [response];
}

function getAllText(response) {
    const texts = [];

    function collect(value) {
        if (value === null || value === undefined) {
            return;
        }

        if (typeof value === "string") {
            if (value.trim()) {
                texts.push(value);
            }
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(collect);
            return;
        }

        if (typeof value === "object") {
            Object.entries(value).forEach(([key, val]) => {
                if (
                    key === "text" ||
                    key === "content" ||
                    key === "message" ||
                    key === "summary"
                ) {
                    collect(val);
                } else if (typeof val === "object") {
                    collect(val);
                }
            });
        }
    }

    collect(response);

    return texts;
}

function getBestAgentText(response) {
    const texts = getAllText(response);

    if (!texts.length) {
        return "";
    }

    let best = texts[0];

    for (const text of texts) {
        if (
            text.length > best.length &&
            (
                text.includes("Suggested itinerary") ||
                text.includes("Trip") ||
                text.includes("Destination") ||
                text.includes("Packing")
            )
        ) {
            best = text;
        }
    }

    return best;
}

function markdownToHtml(text) {
    if (!text) {
        return "";
    }

    let html = escapeHtml(text);

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    html = html.replace(
        /^###\s+(.*?)$/gm,
        "<h4>$1</h4>"
    );

    html = html.replace(
        /^##\s+(.*?)$/gm,
        "<h3>$1</h3>"
    );

    html = html.replace(
        /^#\s+(.*?)$/gm,
        "<h2>$1</h2>"
    );

    html = html.replace(
        /^[-•]\s+(.*?)$/gm,
        "<li>$1</li>"
    );

    html = html.replace(
        /(<li>.*?<\/li>)/gs,
        "<ul>$1</ul>"
    );

    html = html.replace(
        /\n{2,}/g,
        "<br><br>"
    );

    html = html.replace(
        /\n/g,
        "<br>"
    );

    return html;
}

function findElement(ids) {
    for (const id of ids) {
        const element = document.getElementById(id);

        if (element) {
            return element;
        }
    }

    return null;
}

function setElementText(ids, value) {
    const element = findElement(ids);

    if (!element || value === null || value === undefined) {
        return;
    }

    if (String(value).trim()) {
        element.textContent = String(value).trim();
    }
}

function extractDestination(text) {
    const patterns = [
        /Destination\*?\*?\s*[|:]\s*\**([^|\n]+)/i,
        /(?:Trip to|trip to)\s+([A-Z][A-Za-z .'-]+?)(?:\s*\(|\s+with|\s+for|[.,])/,
        /(?:Weekend Trip to|Trip to)\s+([A-Z][A-Za-z .'-]+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match && match[1]) {
            return match[1]
                .replace(/\*\*/g, "")
                .trim();
        }
    }

    return null;
}

function extractDuration(text) {
    const patterns = [
        /Dates\*?\*?\s*[|:]\s*.*?\((\d+)\s*night/i,
        /Duration\*?\*?\s*[|:]\s*([^\n|]+)/i,
        /(\d+)[ -]?day\s+(?:trip|itinerary)/i,
        /Plan a\s+(\d+)[ -]?day/i,
        /(\d+)\s*days?/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match && match[1]) {
            if (/night/i.test(pattern.source)) {
                return `${parseInt(match[1], 10) + 1} days`;
            }

            return `${match[1]} days`;
        }
    }

    return null;
}

function extractWeather(text) {
    const patterns = [
        /Weather\*?\*?\s*[|:]\s*([^\n]+)/i,
        /Weather:\s*([^\n]+)/i,
        /Warm and sunny[^.\n]*(?:\.[^.\n]*)?/i,
        /highs?\s*~?\s*\d+[^.\n]*/i,
        /Air Quality\*?\*?\s*[|:]\s*([^\n]+)/i
    ];

    const parts = [];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match) {
            const value = match[1] || match[0];

            if (
                value &&
                !parts.includes(value.trim())
            ) {
                parts.push(value.trim());
            }
        }
    }

    if (parts.length) {
        return parts.slice(0, 2).join(" ");
    }

    return null;
}

function extractFood(text) {
    const patterns = [
        /Trip Theme\*?\*?\s*[|:]\s*([^\n]+)/i,
        /Thai cuisine/i,
        /Indian cuisine/i,
        /Italian cuisine/i,
        /Mexican cuisine/i,
        /food preference[^:\n]*:\s*([^\n]+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match) {
            return match[1] || match[0];
        }
    }

    return null;
}

function extractBudget(text) {
    const patterns = [
        /Budget\*?\*?\s*[|:]\s*([^\n|]+)/i,
        /Estimated Cost\*?\*?\s*[|:]\s*([^\n|]+)/i,
        /\$\s*[\d,]+(?:\s*-\s*\$?\s*[\d,]+)?/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match) {
            return match[1] || match[0];
        }
    }

    return null;
}

function updateTripSummary(response) {
    const text = getBestAgentText(response);

    if (!text) {
        return;
    }

    const destination = extractDestination(text);
    const duration = extractDuration(text);
    const weather = extractWeather(text);
    const food = extractFood(text);
    const budget = extractBudget(text);

    setElementText(
        ["summaryDestination"],
        destination
    );

    setElementText(
        ["summaryDuration"],
        duration
    );

    setElementText(
        ["summaryWeather"],
        weather
    );

    setElementText(
        ["summaryBudget"],
        budget
    );

    setElementText(
        ["summaryFood"],
        food
    );
}

function renderItinerary(response) {
    const container = findElement([
        "itinerary",
        "itineraryContent",
        "tripItinerary"
    ]);

    if (!container) {
        return;
    }

    const text = getBestAgentText(response);

    if (!text) {
        return;
    }

    let itinerary = text;

    const startIndex = text.search(
        /Suggested itinerary|Itinerary|Daily itinerary/i
    );

    if (startIndex >= 0) {
        itinerary = text.substring(startIndex);
    }

    container.innerHTML = `
        <div class="itinerary-result">
            ${markdownToHtml(itinerary)}
        </div>
    `;
}

function renderWeather(response) {
    const container = findElement([
        "weather",
        "weatherIntelligence",
        "weatherContent"
    ]);

    if (!container) {
        return;
    }

    const text = getBestAgentText(response);

    if (!text) {
        return;
    }

    const weather = extractWeather(text);

    if (!weather) {
        return;
    }

    container.innerHTML = `
        <div class="weather-card">
            <div class="weather-title">
                🌦️ Weather & Air Quality
            </div>

            <div class="weather-content">
                ${markdownToHtml(weather)}
            </div>
        </div>
    `;
}

function renderFood(response) {
    const container = findElement([
        "foodPlanner",
        "foodContent",
        "foodRecommendations"
    ]);

    if (!container) {
        return;
    }

    const text = getBestAgentText(response);

    if (!text) {
        return;
    }

    const foodKeywords = [
        "food",
        "restaurant",
        "cuisine",
        "lunch",
        "dinner",
        "breakfast"
    ];

    const lines = text.split("\n");

    const foodLines = lines.filter(line =>
        foodKeywords.some(keyword =>
            line.toLowerCase().includes(keyword)
        )
    );

    const foodText =
        foodLines.length > 0
            ? foodLines.join("\n")
            : extractFood(text);

    if (!foodText) {
        return;
    }

    container.innerHTML = `
        <div class="food-card">
            <div class="food-title">
                🍛 Personalized Food Recommendations
            </div>

            <div class="food-content">
                ${markdownToHtml(foodText)}
            </div>
        </div>
    `;
}

function renderPacking(response) {
    const container = findElement([
        "packingList",
        "packingContent",
        "smartPacking"
    ]);

    if (!container) {
        return;
    }

    const text = getBestAgentText(response);

    if (!text) {
        return;
    }

    const startIndex = text.search(
        /Packing List|Provide packing list|Packing Recommendations/i
    );

    if (startIndex < 0) {
        return;
    }

    const packingText = text.substring(startIndex);

    container.innerHTML = `
        <div class="packing-card">
            <div class="packing-title">
                🎒 Smart Packing List
            </div>

            <div class="packing-content">
                ${markdownToHtml(packingText)}
            </div>
        </div>
    `;
}

function renderReason(response) {
    const container = findElement([
        "aiReason",
        "reasoning",
        "aiReasoning"
    ]);

    if (!container) {
        return;
    }

    const texts = getAllText(response);

    const reasoningLines = texts.filter(text =>
        /weather|because|reason|decision|condition|recommend/i.test(text)
    );

    if (!reasoningLines.length) {
        return;
    }

    const reasoning = reasoningLines
        .slice(0, 2)
        .join("\n\n");

    container.innerHTML = `
        <div class="ai-reason">
            <div class="ai-reason-title">
                🤖 AI reasoning
            </div>

            <div class="ai-reason-content">
                ${markdownToHtml(reasoning)}
            </div>
        </div>
    `;
}

function renderResponse(response) {
    if (
        response === null ||
        response === undefined
    ) {
        return `
            <div class="result-card">
                No response received.
            </div>
        `;
    }

    const items = getResponseItems(response);

    if (!items.length) {
        return `
            <div class="result-card">
                No response received.
            </div>
        `;
    }

    return items.map((item, index) => {
        let text = "";

        if (typeof item === "string") {
            text = item;
        } else if (item && typeof item === "object") {
            text =
                item.text ||
                item.content ||
                item.message ||
                item.summary ||
                "";
        }

        if (!text) {
            return "";
        }

        const type =
            item && typeof item === "object"
                ? item.type || ""
                : "";

        return `
            <div class="result-section">

                <h3>
                    🤖 Agent Result ${index + 1}
                </h3>

                ${
                    type
                        ? `<div class="result-type">${escapeHtml(type)}</div>`
                        : ""
                }

                <div class="agent-text">
                    ${markdownToHtml(text)}
                </div>

            </div>
        `;
    }).join("");
}

async function sendMessage() {
    const messageBox =
        document.getElementById("message");

    const responseBox =
        document.getElementById("response");

    const button =
        document.getElementById("planButton");

    if (!messageBox || !responseBox || !button) {
        console.error(
            "Required planner elements are missing."
        );
        return;
    }

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
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    message: message
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

        console.log(
            "Trip planner response:",
            data
        );

        responseBox.innerHTML =
            renderResponse(data.response);

        updateTripSummary(data.response);
        renderItinerary(data.response);
        renderWeather(data.response);
        renderFood(data.response);
        renderPacking(data.response);
        renderReason(data.response);

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
