# ClubOps_Ai
 
**Centralized, Agentic Event Operations for College Clubs**

## The Problem: Operational Chaos
College clubs and student organizations operate in a state of constant fragmentation. They rely on chaotic WhatsApp groups, untracked Google Sheets, unstructured meeting notes, and forgotten personal to-do lists. As events scale, communication bottlenecks, missed dependencies, and lost institutional knowledge lead to burnout and execution failure. 

## The Solution: Autonomous AI Execution
**ClubOps AI is not a passive project management tracker.** It is an agentic operations command center. Instead of forcing humans to manually input data, our AI layer bridges human planning with autonomous execution—converting natural language directly into database entities, proactive risk mitigation, and automated team synchronization.

---

## Core Agentic Workflows

*   **One-Prompt Event Planning:** Users submit a basic text prompt (e.g., *"Plan a 24-hour hackathon for 300 students in 4 weeks"*). The AI autonomously decomposes this into a full timeline, generating 20+ granular tasks mapped to specific domains (Logistics, PR, Tech) and saving them directly to the database.
*   **Meeting-to-Action Pipeline:** Instead of manual task entry, the AI ingests raw, messy meeting transcripts, extracts concrete action items, infers task owners based on past workload, assigns strict deadlines, and pushes them to member dashboards.
*   **Institutional RAG Memory:** A vectorized repository of past club documents (sponsorship decks, venue permissions, budget templates). Members can instantly query historical data to avoid starting from scratch year over year.
*   **Live Incident Copilot (War Room):** A dynamic timeline adjuster. If an organizer logs a critical delay (e.g., *"Keynote speaker delayed by 45 mins"*), the AI recalculates downstream dependencies, adjusts the master schedule, and alerts affected volunteers.

---

## Technical Architecture & Stack

We optimized strictly for AI execution speed, relational data integrity, and low-latency UI.

| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Frontend UI** | **Next.js (App Router), Tailwind CSS, Shadcn UI** | High-fidelity, responsive client components (Kanban boards, dashboards) with rapid prototyping. |
| **Backend / AI Orchestrator** | **Python (FastAPI)** | The native ecosystem for AI. Handles asynchronous LLM calls and complex agentic logic with minimal overhead. |
| **Database & Auth** | **Supabase (PostgreSQL + pgvector)** | Provides strict relational data integrity (Events -> Tasks -> Members) alongside native vector embedding storage for our RAG features. |