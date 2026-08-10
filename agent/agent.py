"""
AI agent for the Trip & Outdoor Activity Planner.

The agent uses Databricks Model Serving to reason about user requests
and call application tools for retrieval and database actions.
"""

import json
import os
from databricks_openai import DatabricksOpenAI

from databricks.sdk import WorkspaceClient

from agent import tools


MODEL_ENDPOINT = os.getenv(
    "MODEL_ENDPOINT",
    "system.ai.gpt-oss-120b",
)

workspace = WorkspaceClient()

client = DatabricksOpenAI(
    workspace_client=workspace
)


# ------------------------------------------------------------
# Tool definitions
# ------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_travel_knowledge",
            "description": (
                "Search travel and destination information using "
                "semantic vector search."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Travel information to search for.",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to retrieve.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_destination_weather",
            "description": "Get the weather forecast for a destination.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "forecast_days": {"type": "integer"},
                },
                "required": ["latitude", "longitude"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_air_quality",
            "description": "Get air quality information for a destination.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                },
                "required": ["latitude", "longitude"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trip",
            "description": "Retrieve an existing trip from Lakebase.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trip_id": {"type": "integer"},
                },
                "required": ["trip_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_itinerary",
            "description": "Retrieve the current itinerary for a trip.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trip_id": {"type": "integer"},
                },
                "required": ["trip_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_trip",
            "description": "Create a new trip in Lakebase.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer"},
                    "name": {"type": "string"},
                    "destination": {"type": "string"},
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "budget": {"type": "number"},
                    "preferences": {"type": "string"},
                },
                "required": [
                    "user_id",
                    "name",
                    "destination",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_itinerary_item",
            "description": "Add an activity or item to a trip itinerary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trip_id": {"type": "integer"},
                    "activity_id": {"type": "integer"},
                    "activity_date": {"type": "string"},
                    "start_time": {"type": "string"},
                    "end_time": {"type": "string"},
                    "item_type": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": [
                    "trip_id",
                    "activity_date",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_itinerary_item",
            "description": "Move or update an existing itinerary item.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "integer"},
                    "activity_date": {"type": "string"},
                    "start_time": {"type": "string"},
                    "end_time": {"type": "string"},
                    "notes": {"type": "string"},
                    "status": {"type": "string"},
                },
                "required": ["item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_packing_item",
            "description": "Add an item to a trip packing list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trip_id": {"type": "integer"},
                    "item": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": [
                    "trip_id",
                    "item",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_packing_list",
            "description": "Retrieve a trip's packing list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trip_id": {"type": "integer"},
                },
                "required": ["trip_id"],
            },
        },
    },
]


# ------------------------------------------------------------
# Map model tool names to Python functions
# ------------------------------------------------------------

TOOL_FUNCTIONS = {
    "search_travel_knowledge": tools.search_travel_knowledge,
    "get_destination_weather": tools.get_destination_weather,
    "get_air_quality": tools.get_air_quality,
    "get_trip": tools.get_trip,
    "get_itinerary": tools.get_itinerary,
    "create_trip": tools.create_trip,
    "add_itinerary_item": tools.add_itinerary_item,
    "update_itinerary_item": tools.update_itinerary_item,
    "add_packing_item": tools.add_packing_item,
    "get_packing_list": tools.get_packing_list,
}


# ------------------------------------------------------------
# Execute a tool requested by the model
# ------------------------------------------------------------

def execute_tool(name: str, arguments: dict):
    """Execute one of the registered agent tools."""

    function = TOOL_FUNCTIONS.get(name)

    if function is None:
        return {
            "error": f"Unknown tool: {name}"
        }

    try:
        result = function(**arguments)

        return result

    except Exception as exc:
        return {
            "error": str(exc)
        }


# ------------------------------------------------------------
# Main agent
# ------------------------------------------------------------

def run_agent(
    user_message: str,
    max_tool_rounds: int = 5,
) -> str:
    """
    Run the AI agent.

    The model can repeatedly call tools until it has enough
    information to answer the user.
    """

    messages = [
        {
            "role": "system",
            "content": """
You are an AI Trip and Outdoor Activity Planner.

Your job is to help users plan trips using:
- destination information
- semantic travel knowledge
- weather
- air quality
- itineraries
- packing lists

You have tools that can READ and WRITE data.

Important behavior:

1. Use search_travel_knowledge when destination knowledge
   is needed.

2. Use weather and air-quality tools when outdoor activities
   or weather-sensitive decisions are involved.

3. Use database WRITE tools when the user asks you to create
   or modify something.

4. Do not claim that something was saved or changed unless
   the corresponding tool successfully completed the action.

5. When bad weather affects an outdoor activity, suggest an
   appropriate adjustment and use update_itinerary_item when
   the user has asked for the itinerary to be changed.

6. Keep responses clear and useful.

7. For a trip-planning request, provide a concise trip summary
   explaining the destination, dates, major activities,
   weather considerations, and important packing suggestions.
""",
        },
        {
            "role": "user",
            "content": user_message,
        },
    ]

    for _ in range(max_tool_rounds):

        response = client.chat.completions.create(
            model=MODEL_ENDPOINT,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            temperature=0.2,
            max_tokens=1500,
        )

        choice = response.choices[0]
        message = choice.message

        tool_calls = getattr(message, "tool_calls", None)

        if not tool_calls:
            return message.content or "I could not generate a response."

        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in tool_calls
                ],
            }
        )

        for call in tool_calls:

            arguments = json.loads(
                call.function.arguments
            )

            result = execute_tool(
                call.function.name,
                arguments,
            )

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(
                        result,
                        default=str,
                    ),
                }
            )

    return (
        "I reached the maximum number of tool operations "
        "for this request. Please try a more specific request."
    )
