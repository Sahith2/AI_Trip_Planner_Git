"""
Client for Wikimedia's public APIs.

Used to retrieve destination and attraction information that
will later be processed as unstructured text for semantic search.
"""

import requests


WIKIMEDIA_URL = "https://en.wikipedia.org/w/api.php"

DEFAULT_TIMEOUT = 30


class WikimediaClient:
    """Client for retrieving Wikipedia article information."""

    def __init__(self, timeout: int = DEFAULT_TIMEOUT):
        self.timeout = timeout
        self.session = requests.Session()

        self.session.headers.update(
            {
                "User-Agent": "AITripPlanner/1.0"
            }
        )

    def search_articles(
        self,
        query: str,
        limit: int = 10,
    ) -> list[dict]:
        """
        Search Wikipedia for articles related to a destination
        or attraction.
        """

        response = self.session.get(
            WIKIMEDIA_URL,
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": limit,
                "format": "json",
            },
            timeout=self.timeout,
        )

        response.raise_for_status()

        data = response.json()

        return data.get("query", {}).get("search", [])

    def get_article(self, title: str) -> dict:
        """
        Retrieve the main text of a Wikipedia article.
        """

        response = self.session.get(
            WIKIMEDIA_URL,
            params={
                "action": "query",
                "prop": "extracts|info",
                "explaintext": True,
                "inprop": "url",
                "titles": title,
                "format": "json",
            },
            timeout=self.timeout,
        )

        response.raise_for_status()

        data = response.json()

        pages = data.get("query", {}).get("pages", {})

        if not pages:
            return {}

        page = next(iter(pages.values()))

        if "missing" in page:
            return {}

        return {
            "title": page.get("title"),
            "text": page.get("extract", ""),
            "url": page.get("fullurl"),
        }

    def get_destination_content(
        self,
        destination: str,
        limit: int = 10,
    ) -> list[dict]:
        """
        Search for useful articles about a destination and retrieve
        their article text.
        """

        search_results = self.search_articles(
            destination,
            limit=limit,
        )

        documents = []

        for result in search_results:
            title = result.get("title")

            if not title:
                continue

            article = self.get_article(title)

            if article.get("text"):
                documents.append(article)

        return documents
