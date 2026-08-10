"""
AI Trip & Outdoor Activity Planner
Databricks App backend.

This Flask application:
- Provides the frontend
- Accepts trip-planning requests
- Calls the AI agent
- Returns itinerary/trip responses
"""

from flask import Flask, jsonify, render_template, request

from agent.agent import run_agent


app = Flask(__name__)


# ------------------------------------------------------------
# Home page
# ------------------------------------------------------------

@app.route("/")
def home():
    """Render the main trip-planning interface."""
    return render_template("index.html")


# ------------------------------------------------------------
# AI Trip Planner API
# ------------------------------------------------------------

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Send a user request to the AI trip-planning agent.
    """

    body = request.get_json(silent=True) or {}

    message = body.get("message", "").strip()

    if not message:
        return jsonify(
            {
                "error": "Please provide a message."
            }
        ), 400

    try:
        response = run_agent(message)

        return jsonify(
            {
                "success": True,
                "response": response,
            }
        )

    except Exception as exc:

        return jsonify(
            {
                "success": False,
                "error": str(exc),
            }
        ), 500


# ------------------------------------------------------------
# Health check
# ------------------------------------------------------------

@app.route("/health")
def health():
    """Simple application health check."""

    return jsonify(
        {
            "status": "healthy",
            "application": "AI Trip & Outdoor Activity Planner",
        }
    )


# ------------------------------------------------------------
# Application entry point
# ------------------------------------------------------------

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=8000,
        debug=False,
    )
