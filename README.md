# Netbot

Netbot is an intelligent IT infrastructure assistant designed to help engineers monitor, manage, and automate their network infrastructure using AI.

## Architecture

The project consists of two main components that communicate via Firebase Firestore:

1. **Desktop App (`/desktop`)**: An Electron-based desktop application built with React, TypeScript, and TailwindCSS. It provides the user interface for the assistant and handles direct, local connections (SSH, Telnet, Serial) to network devices.
2. **Agent Backend (`/agent`)**: A Python-based backend powered by the Google ADK (Agent Development Kit). It hosts the LLM agent, processes natural language requests, and dispatches terminal commands to the desktop app via Firestore.

## Prerequisites

- **Bun**: Used for the desktop app (`npm install -g bun`).
- **uv**: Used for the Python agent backend (`pip install uv`).
- **Firebase**: A Firebase project configured with Firestore.

## Getting Started

You will need to run both the frontend and backend concurrently for the application to function.

### 1. Start the Desktop App

```bash
cd desktop
bun install
bun run dev
```

### 2. Start the Agent Backend

```bash
cd agent
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

## Features
- **Intelligent Assistant**: Interact with your network devices using natural language.
- **Local Execution**: Terminal commands (SSH, Telnet, Serial) are executed locally on your machine via the Electron app, ensuring secure access to your private network infrastructure.
- **Real-time Sync**: Device configurations and command executions are synchronized in real-time across the platform using Firestore.