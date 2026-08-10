"""
Tools used by the AI trip-planning agent.

The tools provide the agent with access to:
- Lakebase trip data
- Weather information
- Semantic travel search
- Itinerary updates
- Packing-list management
"""

from datetime import date

from clients.openmeteo_client import OpenMeteoClient
from db import lakebase


_weather_client = OpenMeteoClient()


def search_travel_knowledge(
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Search embedded travel documents using vector similarity.

    This is the agent's semantic retrieval tool.
    """

    # Import the model only when the tool is used.
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(
        "sentence-transformers/all-MiniLM-L6-v2"
    )

    query_vector = model.encode(
        query,
        normalize_embeddings=True,
    ).tolist()

    rows = lakebase.fetch_all(
        """
        SELECT
            d.id AS document_id,
            d.title,
            d.source_url,
            e.chunk_text,
            1 - (e.embedding <=> %s::vector) AS similarity
        FROM travel_embeddings e
        JOIN travel_documents d
            ON d.id = e.document_id
        ORDER BY e.embedding <=> %s::vector
        LIMIT %s
        """,
        (
            str(query_vector),
            str(query_vector),
            top_k,
        ),
    )

    return rows


def get_destination_weather(
    latitude: float,
    longitude: float,
    forecast_days: int = 7,
) -> dict:
    """
    Retrieve a weather forecast for a destination.
    """

    return _weather_client.get_weather(
        latitude=latitude,
        longitude=longitude,
        forecast_days=forecast_days,
    )


def get_air_quality(
    latitude: float,
    longitude: float,
) -> dict:
    """
    Retrieve air-quality information for a destination.
    """

    return _weather_client.get_air_quality(
        latitude=latitude,
        longitude=longitude,
    )


def get_trip(trip_id: int) -> dict | None:
    """
    Retrieve a trip and its basic information.
    """

    return lakebase.fetch_one(
        """
        SELECT
            id,
            user_id,
            name,
            destination,
            start_date,
            end_date,
            budget,
            preferences
        FROM trips
        WHERE id = %s
        """,
        (trip_id,),
    )


def get_itinerary(trip_id: int) -> list[dict]:
    """
    Retrieve the current itinerary for a trip.
    """

    return lakebase.fetch_all(
        """
        SELECT
            i.id,
            i.activity_date,
            i.start_time,
            i.end_time,
            i.item_type,
            i.notes,
            i.status,
            a.name AS activity_name,
            a.description AS activity_description,
            a.category,
            a.indoor_outdoor,
            a.estimated_cost
        FROM itinerary_items i
        LEFT JOIN activities a
            ON a.id = i.activity_id
        WHERE i.trip_id = %s
        ORDER BY
            i.activity_date,
            i.start_time
        """,
        (trip_id,),
    )


def create_trip(
    user_id: int,
    name: str,
    destination: str,
    start_date: str | None = None,
    end_date: str | None = None,
    budget: float | None = None,
    preferences: str | None = None,
) -> dict | None:
    """
    Create a new trip in Lakebase.

    This is an agent WRITE operation.
    """

    return lakebase.execute_returning(
        """
        INSERT INTO trips (
            user_id,
            name,
            destination,
            start_date,
            end_date,
            budget,
            preferences
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        RETURNING
            id,
            user_id,
            name,
            destination,
            start_date,
            end_date,
            budget,
            preferences
        """,
        (
            user_id,
            name,
            destination,
            start_date,
            end_date,
            budget,
            preferences,
        ),
    )


def add_itinerary_item(
    trip_id: int,
    activity_id: int | None,
    activity_date: str,
    start_time: str | None = None,
    end_time: str | None = None,
    item_type: str = "activity",
    notes: str | None = None,
) -> dict | None:
    """
    Add an item to a trip itinerary.

    This is an agent WRITE operation.
    """

    return lakebase.execute_returning(
        """
        INSERT INTO itinerary_items (
            trip_id,
            activity_id,
            activity_date,
            start_time,
            end_time,
            item_type,
            notes
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        RETURNING
            id,
            trip_id,
            activity_id,
            activity_date,
            start_time,
            end_time,
            item_type,
            notes,
            status
        """,
        (
            trip_id,
            activity_id,
            activity_date,
            start_time,
            end_time,
            item_type,
            notes,
        ),
    )


def update_itinerary_item(
    item_id: int,
    activity_date: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    notes: str | None = None,
    status: str | None = None,
) -> dict | None:
    """
    Update an existing itinerary item.

    This is an agent WRITE operation and will power
    weather-based rescheduling.
    """

    existing = lakebase.fetch_one(
        """
        SELECT
            activity_date,
            start_time,
            end_time,
            notes,
            status
        FROM itinerary_items
        WHERE id = %s
        """,
        (item_id,),
    )

    if not existing:
        return None

    return lakebase.execute_returning(
        """
        UPDATE itinerary_items
        SET
            activity_date = COALESCE(%s, activity_date),
            start_time = COALESCE(%s, start_time),
            end_time = COALESCE(%s, end_time),
            notes = COALESCE(%s, notes),
            status = COALESCE(%s, status)
        WHERE id = %s
        RETURNING
            id,
            trip_id,
            activity_id,
            activity_date,
            start_time,
            end_time,
            item_type,
            notes,
            status
        """,
        (
            activity_date,
            start_time,
            end_time,
            notes,
            status,
            item_id,
        ),
    )

def remove_itinerary_item(item_id: int, reason: str | None = None) -> dict | None:
    """
    Remove an item from a trip itinerary.

    This is an agent WRITE operation and powers
    weather-based rescheduling / cleanup.
    """

    existing = lakebase.fetch_one(
        """
        SELECT id, trip_id
        FROM itinerary_items
        WHERE id = %s
        """,
        (item_id,),
    )

    if not existing:
        return None

    lakebase.execute_returning(
        """
        DELETE FROM itinerary_items
        WHERE id = %s
        RETURNING id
        """,
        (item_id,),
    )

    return {
        "success": True,
        "item_id": item_id,
        "reason": reason,
    }


def add_packing_item(
    trip_id: int,
    item: str,
    reason: str | None = None,
) -> dict | None:
    """
    Add an item to a trip's packing list.

    This is another agent WRITE operation.
    """

    return lakebase.execute_returning(
        """
        INSERT INTO packing_items (
            trip_id,
            item,
            reason
        )
        VALUES (
            %s,
            %s,
            %s
        )
        RETURNING
            id,
            trip_id,
            item,
            reason,
            completed
        """,
        (
            trip_id,
            item,
            reason,
        ),
    )


def get_packing_list(trip_id: int) -> list[dict]:
    """
    Retrieve the packing list for a trip.
    """

    return lakebase.fetch_all(
        """
        SELECT
            id,
            item,
            reason,
            completed
        FROM packing_items
        WHERE trip_id = %s
        ORDER BY id
        """,
        (trip_id,),
    )
