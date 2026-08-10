"""
Spark pipeline for the AI Trip & Outdoor Activity Planner.

The pipeline:
1. Retrieves destination content from Wikimedia.
2. Uses Spark to create a structured dataset.
3. Cleans and transforms the unstructured text.
4. Writes the processed documents to Lakebase.

This provides the Spark data-pipeline component of the capstone.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col,
    current_timestamp,
    length,
    lower,
    regexp_replace,
    trim,
    when,
)

from clients.wikimedia_client import WikimediaClient
from db import lakebase


def create_spark_session() -> SparkSession:
    """Create or retrieve a Spark session."""
    return (
        SparkSession.builder
        .appName("AITripPlannerPipeline")
        .getOrCreate()
    )


def collect_wikimedia_documents(
    destination: str,
    limit: int = 10,
) -> list[dict]:
    """Retrieve destination articles from Wikimedia."""
    client = WikimediaClient()

    articles = client.get_destination_content(
        destination=destination,
        limit=limit,
    )

    documents = []

    for article in articles:
        text = article.get("text", "").strip()

        if not text:
            continue

        documents.append(
            {
                "destination": destination,
                "title": article.get("title", ""),
                "content": text,
                "source_url": article.get("url", ""),
                "source_type": "wikimedia",
            }
        )

    return documents


def transform_documents(spark: SparkSession, documents: list[dict]):
    """
    Use Spark to clean and transform the retrieved text.
    """

    df = spark.createDataFrame(documents)

    cleaned_df = (
        df
        .withColumn(
            "content",
            regexp_replace(col("content"), r"\s+", " ")
        )
        .withColumn(
            "content",
            trim(col("content"))
        )
        .withColumn(
            "content_lower",
            lower(col("content"))
        )
        .withColumn(
            "content_length",
            length(col("content"))
        )
        .withColumn(
            "quality",
            when(col("content_length") >= 500, "usable")
            .otherwise("short")
        )
        .withColumn(
            "processed_at",
            current_timestamp()
        )
    )

    return cleaned_df


def save_documents_to_lakebase(df) -> int:
    """
    Write processed documents into the Lakebase
    travel_documents table.
    """

    rows = (
        df
        .filter(col("quality") == "usable")
        .select(
            "destination",
            "title",
            "content",
            "source_url",
            "source_type",
        )
        .collect()
    )

    inserted = 0

    for row in rows:
        document_id = (
            f"{row['destination']}:"
            f"{row['title']}"
        )

        lakebase.execute(
            """
            INSERT INTO travel_documents (
                id,
                source_type,
                title,
                content,
                source_url,
                metadata
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s::jsonb
            )
            ON CONFLICT (id)
            DO UPDATE SET
                content = EXCLUDED.content,
                source_url = EXCLUDED.source_url,
                metadata = EXCLUDED.metadata
            """,
            (
                document_id,
                row["source_type"],
                row["title"],
                row["content"],
                row["source_url"],
                f'{{"destination": "{row["destination"]}"}}',
            ),
        )

        inserted += 1

    return inserted


def run_pipeline(
    destinations: list[str],
    articles_per_destination: int = 10,
):
    """
    Run the complete Spark ingestion pipeline.
    """

    spark = create_spark_session()

    try:
        all_documents = []

        for destination in destinations:
            documents = collect_wikimedia_documents(
                destination,
                limit=articles_per_destination,
            )

            all_documents.extend(documents)

        if not all_documents:
            print("No documents were retrieved.")
            return

        transformed_df = transform_documents(
            spark,
            all_documents,
        )

        print("Spark pipeline output:")
        transformed_df.select(
            "destination",
            "title",
            "content_length",
            "quality",
        ).show(truncate=False)

        inserted = save_documents_to_lakebase(
            transformed_df
        )

        print(
            f"Pipeline completed. "
            f"{inserted} documents saved to Lakebase."
        )

    finally:
        spark.stop()


if __name__ == "__main__":
    run_pipeline(
        destinations=[
            "Austin",
            "Chicago",
            "Atlanta",
        ],
        articles_per_destination=5,
    )
