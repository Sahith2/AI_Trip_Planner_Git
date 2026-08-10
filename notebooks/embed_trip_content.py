"""
Embedding pipeline for the AI Trip & Outdoor Activity Planner.

Reads unstructured travel documents from Lakebase, creates text chunks,
generates embeddings using Sentence Transformers, and stores the
vectors back in Lakebase.
"""

import sys
from pathlib import Path

from sentence_transformers import SentenceTransformer


# Allow the notebook/script to import project modules.
PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from db import lakebase


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def split_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    """
    Split long text into overlapping chunks.
    """

    text = text.strip()

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = end - overlap

    return chunks


def get_documents() -> list[dict]:
    """Retrieve travel documents that need embeddings."""

    return lakebase.fetch_all(
        """
        SELECT
            id,
            content
        FROM travel_documents
        ORDER BY created_at
        """
    )


def save_embedding(
    document_id: str,
    chunk_index: int,
    chunk_text: str,
    embedding: list[float],
):
    """Save one embedding into Lakebase."""

    lakebase.execute(
        """
        INSERT INTO travel_embeddings (
            document_id,
            chunk_index,
            chunk_text,
            embedding,
            model_name
        )
        VALUES (
            %s,
            %s,
            %s,
            %s::vector,
            %s
        )
        """,
        (
            document_id,
            chunk_index,
            chunk_text,
            str(embedding),
            MODEL_NAME,
        ),
    )


def run_embedding_pipeline():
    """Create and store embeddings for travel documents."""

    model = SentenceTransformer(MODEL_NAME)

    documents = get_documents()

    if not documents:
        print("No travel documents found.")
        return

    total_chunks = 0

    for document in documents:

        document_id = document["id"]
        content = document["content"]

        chunks = split_text(content)

        if not chunks:
            continue

        # Avoid duplicating embeddings when the pipeline is run again.
        lakebase.execute(
            """
            DELETE FROM travel_embeddings
            WHERE document_id = %s
            """,
            (document_id,),
        )

        embeddings = model.encode(
            chunks,
            normalize_embeddings=True,
        )

        for index, (chunk, vector) in enumerate(
            zip(chunks, embeddings)
        ):
            save_embedding(
                document_id=document_id,
                chunk_index=index,
                chunk_text=chunk,
                embedding=vector.tolist(),
            )

            total_chunks += 1

    print(
        f"Embedding pipeline completed. "
        f"Created {total_chunks} chunks."
    )


if __name__ == "__main__":
    run_embedding_pipeline()
