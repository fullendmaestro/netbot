# Netbot Agent Backend

The intelligence engine for Netbot, built using Python and the Google Agent Development Kit (ADK).

## Overview

The backend hosts the LLM-powered assistant. When a user requests an action (e.g., "Check the routing table on R1-Core"):
1. The agent proxy endpoints interact with LibreNMS to sync device states or retrieve monitoring data.
2. The agent fetches the connection details for the requested device from Firebase Firestore.
3. The agent determines the appropriate terminal commands to execute.
4. The agent executes the commands directly against the device over SSH or Telnet using Nornir and Netmiko.
5. The agent analyzes the terminal output and responds to the user.

## Tech Stack
- Python
- Google ADK (Agent Development Kit)
- FastAPI / Uvicorn (for the API backend)
- Firebase Admin SDK (for Firestore connectivity)
- `uv` (for fast Python package management)

## Setup and Development

### Prerequisites
Make sure you have `uv` installed (`pip install uv`).

### Start the Agent Server

Start the backend server on `localhost:8000`:

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```
