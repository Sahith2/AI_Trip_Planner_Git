# ✈️ AI Trip & Outdoor Activity Planner

An AI-powered trip planning application built on **Databricks** that creates personalized itineraries using AI reasoning, semantic travel search, real-time weather and air-quality information, and persistent trip data in Lakebase.

## 🚀 Overview

The application allows users to enter a natural-language trip request such as:

> "Plan a 3-day weekend trip to Austin with outdoor activities and good food."

The AI agent analyzes the request, retrieves relevant travel information, checks environmental conditions, and generates a personalized trip plan.

The application presents the results through a web dashboard containing:

- Trip Summary
- Day-by-day Itinerary
- Weather Intelligence
- Food Planner
- Smart Packing List
- AI Decision Explanation

The UI explicitly supports weather-aware planning, semantic travel search, itinerary management, food recommendations, smart packing, and AI tool calling. :contentReference[oaicite:0]{index=0}

---

## 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │      User / UI       │
                    │   HTML / CSS / JS    │
                    └──────────┬───────────┘
                               │
                               │ POST /api/chat
                               ▼
                    ┌──────────────────────┐
                    │   Flask Backend      │
                    │      app.py          │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Databricks AI Agent  │
                    │ Model Serving        │
                    │ gpt-oss-120b         │
                    └──────────┬───────────┘
                               │
                  ┌────────────┼─────────────┐
                  │            │             │
                  ▼            ▼             ▼
          Travel Search    Weather       Air Quality
          Vector Search      API             API
                  │
                  ▼
              Lakebase
        Trips / Itineraries /
          Packing Lists
