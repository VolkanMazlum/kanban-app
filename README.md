# 📋 ProjeBoard — AI-Powered Enterprise Kanban & ERP System

[![Docker Pulls](https://img.shields.io/docker/pulls/yourdockerhub/projeboard?style=flat-square)](https://hub.docker.com/r/yourdockerhub/projeboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-brightgreen?style=flat-square&logo=react)](https://reactjs.org/)
[![Ollama](https://img.shields.io/badge/AI-Ollama_Llama-orange?style=flat-square)](https://ollama.com/)

---

## ✨ Executive Summary

**ProjeBoard** is a sophisticated, self‑hosted **Enterprise Resource Planning (ERP)** and **Project Management** solution. Originally conceived as a Kanban board, it has evolved into a comprehensive suite capable of handling complex organizational workflows. 

By unifying **Task Management**, **Financial Ledgering (Fatturato)**, **Client Relationship Management (CRM)**, **Sales Pipeline (Offerte)**, **Human Resources (HR) Costing**, and a strictly private **Local AI Assistant**, ProjeBoard offers organizations a single source of truth for all operational metrics. Everything is containerized and managed via Docker Compose, ensuring scalability, security, and ease of deployment.

---

## 📚 Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Core Modules & Business Logic](#2-core-modules--business-logic)
   - [A. Kanban & Project Management](#a-kanban--project-management)
   - [B. Offers Pipeline (Offerte)](#b-offers-pipeline-offerte)
   - [C. Financial Accounting (Fatturato)](#c-financial-accounting-fatturato)
   - [D. Client CRM (Anagrafica)](#d-client-crm-anagrafica)
   - [E. Human Resources & Cost Analytics](#e-human-resources--cost-analytics)
   - [F. Local AI Assistant (Ollama)](#f-local-ai-assistant-ollama)
3. [Directory Structure](#3-directory-structure)
4. [Deployment & Installation](#4-deployment--installation)
   - [Environment Configuration](#environment-configuration)
   - [Docker Setup](#docker-setup)
5. [Local Development Guide](#5-local-development-guide)
6. [API Reference & Integrations](#6-api-reference--integrations)
7. [Security & Access Control](#7-security--access-control)
8. [Testing & Quality Assurance](#8-testing--quality-assurance)
9. [License & Contribution](#9-license--contribution)

---

## 1. System Architecture

ProjeBoard strictly adheres to a modular **Microservices** pattern orchestrated via Docker Compose. The application relies on five distinct containers working in tandem:

- **`db` (PostgreSQL 16):** The relational backbone of the system. Maintains strict data integrity using Row-Level Security, cascading constraints, and complex foreign key mappings between projects, clients, and financial lines.
- **`backend` (Node.js/Express):** A robust RESTful API layer. Handles authentication logic, complex SQL aggregations for financial data, server-side data validation (using Zod), and dynamic `.xlsx` report generation using `ExcelJS`.
- **`frontend` (React/Vite):** A high-performance Single Page Application (SPA). Utilizes modern React Hooks for state management and Axios for seamless API communication.
- **`ollama`:** A local AI inference server that keeps LLM processing entirely offline, ensuring absolute data privacy for confidential HR and financial queries.
- **`ollama-pull-model`:** An ephemeral setup script container that automatically pulls the defined AI model (`gemma2:2b` by default) into the `ollama` container upon initial boot.

---

## 2. Core Modules & Business Logic

### A. Kanban & Project Management
At its core, the system allows project tracking via a dynamic Kanban board.
- **Task Lifecycle:** Tasks move through configurable statuses (`new`, `process`, `blocked`, `done`).
- **Phase Templating:** Complex projects can inherit heavily localized workflow phases (e.g., *MEP, ENERGY, SUSTAINABILITY, BREEAM*). Each phase tracks planned vs. actual start/end dates.
- **Concurrency Protection:** Implements stringent background checks (Row-Level Locking mechanisms) to prevent data corruption when multiple users manipulate the same task simultaneously.
- **Time Logging:** Employees can punch in/out of tasks, generating granular timesheets utilized later by the HR calculation engine.

### B. Offers Pipeline (Offerte)
A dedicated module bridging the gap between Sales and Operations.
- **Draft & Revision Control:** Sales teams track offers drafted for clients. Offers retain revision numbers and `is_final_revision` flags.
- **Automatic Project Conversion:** Once an offer is marked as **`Accettata`** (Accepted), the system's backend automates the creation of a corresponding **Task** and **Commessa** (Project Folder), drastically reducing manual data entry.
- **Financial Linking:** Categorized items inside the offer automatically translate into financial billing lines (`fatturato_lines`).

### C. Financial Accounting (Fatturato)
The financial spine of the application rests on a rigid **3-Tier Hierarchical Structure**:
1. **Tier 1: Commessa (Project Folder):** The overarching corporate project ID.
2. **Tier 2: Client Mapping (`commessa_clients`):** A single Commessa can involve multiple stakeholders. This tier allocates the financial burden per client to a specific project.
3. **Tier 3: Fatturato Lines (`fatturato_lines`):** Specific activities (e.g., 'Preliminary Design').
   - Contains predicted billing limits (**Proforma**).
   - Maps percentage-based expected payments (**Ordini**).
   - Tracks actual realized invoices (**Realized**).

### D. Client CRM (Anagrafica)
An extensive database module designed for complete Italian business compliance (can be adapted globally). 
- **Fiscal Identifiers:** `Partita IVA` (VAT), `Codice Fiscale`, `Codice Univoco`, `Codice Ateco`.
- **Payment & Bank Tracking:** IBAN, SWIFT, and established payment terms (e.g., "BONIFICO 60 gg").
- **Electronic Billing:** Stores certified email (`PEC`) addresses and foreign entity flags.

### E. Human Resources & Cost Analytics
A highly secured, `HR-only` dashboard providing business intelligence on organizational expenditure.
- **Dynamic Employee Costs:** Salaries can change over time. The system calculates hourly overheads dynamically based on valid compensation intervals combined with monthly logged hours.
- **Overtime Tracker:** HR can manage external/internal overtime metrics manually.
- **Extra Costs:** Tracks one-off expenses (Travel, Tickets) linked definitively to a task and an employee.
- **Consultant Models:** Accurately distributes consultant labor overhead proportionally across their contract lifetimes, handling zero-hour reporting accurately.

### F. Local AI Assistant (Ollama)
A strictly private HR and Operational assistant built directly into the UI.
- It can read live context from the database regarding specific project timesheets, workloads, and task bottlenecks.
- Never connects to public internet endpoints (No OpenAI APIs, No Data Leaks).
- Built around `gemma2:2b` or any compatible model fetched via Ollama.

---

## 3. Directory Structure

```text
kanban-app/
├── backend/
│   ├── src/
│   │   ├── config/             # DB configurations & pooled connections
│   │   ├── middleware/         # Auth (JWT), Rate Limiting, Audit Hooks
│   │   ├── routes/             # Isolated Modular REST controllers
│   │   └── utils/              # Calculation helpers & Overtime sync logics
│   ├── db/
│   │   ├── init.sql            # Core Relational schema (Tables & Triggers)
│   │   └── migrations/         # Delta changes for structural shifts
│   └── index.js                # Express App bootstrap
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios interceptors & backend bindings
│   │   ├── components/         # Reusable UI Blocks (Modals, Panels)
│   │   ├── pages/              # Primary Route Views
│   │   ├── constants/          # Application-level constants (Months, UI strings)
│   │   └── App.jsx             # React Router DOM mapping
├── docker-compose.yml          # Container topology definition
├── .env.example                # Sandbox for Environment Variables
└── README.md                   # This document
```

---

## 4. Deployment & Installation

### Environment Configuration
Never commit secrets to version control. ProjeBoard depends on an `.env` file at the root directory. To begin, create your `.env` file:

```dotenv
# .env 
# ----------------------------------------------------
# 🚨 SECURITY WARNING: REPLACE ALL VALUES BELOW 🚨
# ----------------------------------------------------

# PostgreSQL Local Configuration
POSTGRES_USER=<YOUR_DB_USERNAME>
POSTGRES_PASSWORD=<YOUR_DB_SECURE_PASSWORD>
POSTGRES_DB=<YOUR_DB_NAME>

# Express Backend URL map
DATABASE_URL=postgresql://<YOUR_DB_USERNAME>:<YOUR_DB_SECURE_PASSWORD>@db:5432/<YOUR_DB_NAME>?schema=public

# Networking & Secrets
PORT=4000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=<YOUR_LONG_RANDOM_HASH_FOR_JWT>
INTERNAL_SECRET=<YOUR_MACHINE_TO_MACHINE_SECRET>
```

### Docker Setup
Once environment variables are securely mapped, deploy the entire stack dynamically.

```bash
# 1. Build and boot all containers in the background
docker compose up --build -d

# 2. View initialization logs (Highly recommended to ensure DB seed is successful)
docker compose logs -f db backend

# 3. Monitor the Ollama Model Pull (Wait for completion)
docker compose logs -f ollama-pull-model
```

**Accessing the Application:**
- **Web UI:** Navigate to [http://localhost:3000](http://localhost:3000)
- **API Base:** [http://localhost:4000/api](http://localhost:4000/api)
- **Ollama Engine:** [http://localhost:11434](http://localhost:11434)

---

## 5. Local Development Guide

For active development, you may want to run the stack natively instead of inside containers to utilize hot-reloading efficiently.

**Backend (Express):**
```bash
cd backend
npm install
# Runs Nodemon for hot-reloading
npm run dev
```

**Frontend (React/Vite):**
```bash
cd frontend
npm install
# Starts Vite server on port 5173
npm run dev
```

*(Ensure you have a PostgreSQL instance running locally or bind the Docker DB container port appropriately if mixing environments).*

---

## 6. API Reference & Integrations

All API endpoints are prefixed with `/api` and most require **JWT Bearer Token Authentication** (`role = 'standard'` or `'hr'`). Below is a detailed breakdown of the primary operational endpoints.

### 🏢 Tasks & Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Fetch a list of tasks. Supports `?status`, `?assignee_id` query filters. |
| GET | `/api/tasks/:id` | Detailed task retrieval (phases, topics, assignees). |
| POST | `/api/tasks` | Create a new task and associated phased workflow. |
| PATCH | `/api/tasks/:id/status` | Update task status (cascades to internal phases). |

### 💼 CRM & Clients (Anagrafica)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | Retrieve all master client CRM records including VAT/Ateco. |
| POST | `/api/clients` | Insert a new client compliant with the Italian SDI standard. |

### 🚀 Offers (Offerte)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offerte?year=` | List pipeline offers by financial year with status. |
| POST | `/api/offerte` | Save a new draft offer/preventivo. |
| POST | `/api/offerte/:id/convert` | Converts an "Accettata" offer into an active project. |

### 💰 ERP & Financials (Fatturato)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fatturato?year=` | Full financial map (Commesse -> Clients -> Proforma -> Invoices). |
| POST | `/api/fatturato/lines` | Add a new tracking category (linea) to a project. |
| POST | `/api/fatturato/realized` | Log an actual invoiced entry against an expected Proforma. |
| GET | `/api/task-finances` *(HR)* | View cumulative task revenues vs labor cost metrics. |

### 👥 HR, Costs & Analytics *(HR Role Required)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/work-hours` | Employee pushes time-log per task (clock in). |
| GET | `/api/costs` | Fetches base gross annual income arrays. |
| GET | `/api/costs/:id/overtime` | Fetches historical external overtime logs. |
| GET | `/api/kpi/workload-monthly` | Calculate load distributions and theoretical bottlenecks. |

### 🤖 Reporting & AI Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/timesheet-labor` | Stream generated `.xlsx` for HR labor auditing. |
| GET | `/api/reports/workload` | Generate native `.xlsx` describing organization-wide capacity. |
| POST | `/api/ai/chat` | Query the local Ollama context engine safely. |
| GET | `/api/audit-logs` *(HR)* | View system-wide security actions & user trails. |

---

## 7. Security & Access Control

- **Encryption at Rest:** All user passwords are computationally hashed utilizing `bcrypt`.
- **Stateless Tokens:** Employs JSON Web Tokens (JWT) mapped closely to Active Directory identifiers (`username`, `role`, `employeeId`).
- **Rate Limiting:** `express-rate-limit` throttles login endpoints globally to prevent automated Brute-Force operations.
- **API Hardening:** Protected via `helmet` and rigorously parsed with `zod` pre-request schemas to prevent SQL injection and bad datatypes matching.
- **Role-Based Guards:** `authenticateHR` middleware ensures standard users literally cannot interrogate `/costs` or `/audit-logs` endpoints.

---

## 8. Testing & Quality Assurance

ProjeBoard operates with a test-driven mindset. Tests are isolated in the `backend/src/tests/` block using **Jest** and **Supertest**. 

**Running the Test Suite:**
```bash
# Enter the backend container
docker exec -it kanban_backend /bin/sh

# Trigger the entire suite
npm test

# Trigger a specific finance evaluation test
npx jest src/tests/finance.test.js
```
*Note: Our tests execute independently by generating rapid ephemeral schema setups within PostgreSQL to ensure logic is flawless.*

---

## 9. License & Contribution

This software architecture constitutes a proprietary framework, licensed entirely under the **MIT License**. Check the [`LICENSE`](LICENSE) document in the root repository for thorough redistribution, warranty, and patent specifics. 

**For direct contributors:**
- Always ensure branches maintain the strict naming convention: `feature/name-of-feature` or `hotfix/name-of-bug`.
- Run formatting and ensure the Postman test suites pass before submitting Pull Requests.

---

*Powered by React, Node.js, and Ollama. Orchestrated for Enterprise Productivity.*
