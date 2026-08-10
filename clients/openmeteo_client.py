"""
Client for the Open-Meteo APIs.

Provides:
- Geocoding
- Weather forecasts
- Air quality forecasts
"""

import requests


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

DEFAULT_TIMEOUT = 30


class OpenMeteoClient:
    """Small client for the Open-Meteo APIs."""

    def __init__(self, timeout: int = DEFAULT_TIMEOUT):
        self.timeout = timeout
        self.session = requests.Session()

    def geocode(self, location: str) -> dict:
        """
        Convert a destination name into latitude and longitude.
        """
        response = self.session.get(
            GEOCODING_URL,
            params={
                "name": location,
                "count": 1,
                "language": "en",
                "format": "json",
            },
            timeout=self.timeout,
        )

        response.raise_for_status()

        data = response.json()
        results = data.get("results", [])

        if not results:
            raise ValueError(
                f"Could not find coordinates for '{location}'."
            )

        result = results[0]

        return {
            "name": result.get("name"),
            "latitude": result.get("latitude"),
            "longitude": result.get("longitude"),
            "country": result.get("country"),
            "state": result.get("admin1"),
        }

    def get_weather(
        self,
        latitude: float,
        longitude: float,
        forecast_days: int = 7,
    ) -> dict:
        """
        Get daily weather forecast for a location.
        """
        response = self.session.get(
            WEATHER_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "forecast_days": forecast_days,
                "daily": (
                    "weather_code,"
                    "temperature_2m_max,"
                    "temperature_2m_min,"
                    "precipitation_probability_max,"
                    "precipitation_sum"
                ),
                "timezone": "auto",
            },
            timeout=self.timeout,
        )

        response.raise_for_status()

        return response.json()

    def get_air_quality(
        self,
        latitude: float,
        longitude: float,
        forecast_days: int = 5,
    ) -> dict:
        """
        Get air-quality forecast for a location.
        """
        response = self.session.get(
            AIR_QUALITY_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "forecast_days": forecast_days,
                "hourly": (
                    "pm10,"
                    "pm2_5,"
                    "us_aqi"
                ),
                "timezone": "auto",
            },
            timeout=self.timeout,
        )

        response.raise_for_status()

        return response.json()
