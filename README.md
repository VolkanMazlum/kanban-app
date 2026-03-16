# 📋 ProjeBoard — Kanban Management System

[![Docker Pulls](https://img.shields.io/docker/pulls/yourdockerhub/projeboard?style=flat-square)](https://hub.docker.com/r/yourdockerhub/projeboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-brightgreen?style=flat-square&logo=react)](https://reactjs.org/)

---

## ✨ Overview

**ProjeBoard** is a self‑hosted Kanban board for internal project management. It combines a **React + Vite** frontend, **Node.js + Express** backend, and a **PostgreSQL** database. All services are containerised and orchestrated with **Docker Compose** for a one‑click deployment experience.

---

## 📚 Table of Contents

- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Installation & Running](#-installation--running)
  - [Docker (recommended)](#docker-recommended)
  - [Local Development](#local-development)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
  - [Tasks](#tasks)
  - [Employees](#employees)
  - [KPI](#kpi)
  - [Phases & Templates](#phases--templates)
  - [Work Hours & Costs](#work-hours--costs)
  - [Overtime](#overtime)
  - [Task Finances](#task-finances)
- [Features](#-features)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🏗️ Architecture

```text
kanban-app/
├── docker-compose.yml          # Orchestrates all services
├── backend/                    # Express API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Server entry point
│       ├── auth.js             # JWT auth middleware (Standard & HR roles)
│       ├── employees.js        # Employee CRUD
│       ├── kpi.js              # KPI endpoint
│       ├── phases.js           # Phase & template logic
│       ├── settings.js         # Settings & Config endpoints
│       ├── tasks.js            # Full task CRUD with phases & topics
│       ├── timeLogs.js         # Time-tracking endpoints
│       ├── costs.js            # Work-hours, cost calculations, overtime
│       ├── fatturato.js        # Revenue, invoicing, and client management
│       ├── validation.js       # Zod schemas
│       ├── login.js            # JWT login endpoints
│       └── db/
│           └── init.sql        # DB schema & seed data
├── frontend/                   # React SPA
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api.js              # API client wrapper
│       ├── components/
│       │   ├── HRFinanceDashboard.jsx
│       │   ├── FatturatoDashboard.jsx
│       │   ├── ProjectFinances.jsx
│       │   ├── ClientsManager.jsx
│       │   ├── Login.jsx
│       │   └── …
│       └── constants/
│           └── index.js
└── .env                        # Shared env vars (Docker secrets)
```

---

## 📸 Screenshots

| Board View | Task Modal |
|---|---|
| ![Board](./docs/screenshots/board.png) | ![Task Modal](./docs/screenshots/task-modal.png) |

*Add your own screenshots under `docs/screenshots/`.*

---

## 🚀 Installation & Running

### Docker (recommended)

```bash
# Clone the repository
git clone <repo-url>
cd kanban-app

# Copy example environment file and edit the values you need
cp .env.example .env
# Open .env in your favorite editor and set POSTGRES credentials, auth user/pass, etc.

# Build and start all services (detached mode)
docker compose up --build -d
```

The stack will be available at:
- **Frontend:** <http://localhost:3000>
- **Backend API:** <http://localhost:4000/api>
- **PostgreSQL:** `localhost:5432` (use credentials from `.env`)

### Local Development (without Docker)

#### Backend

```bash
cd backend
npm install
npm run dev   # Starts API on http://localhost:4000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev   # Vite dev server at http://localhost:5173
```

---

## ⚙️ Environment Variables

The project uses a shared `.env` file. Important keys include:

```dotenv
# Docker / PostgreSQL
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
DATABASE_URL=postgresql://user:pass@db:5432/db

# Backend Authentication
PORT=4000
JWT_SECRET=...                # Secret for token signing
INTERNAL_SECRET=...           # Secret for X-Internal-Auth headers
FRONTEND_URL=http://localhost:5173
```

---

## 📡 API Reference

All endpoints are prefixed with `/api` and require **JWT Bearer Token Authentication** (see `backend/src/auth.js`).

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks, optional filters `?assignee_id=` or `?status=` |
| GET | `/api/tasks/:id` | Retrieve a task with its phases, topics, and assignees |
| POST | `/api/tasks` | Create a new task (include `phases` array in body) |
| PUT | `/api/tasks/:id` | Full update of a task (including phases) |
| PATCH | `/api/tasks/:id/status` | Update only the `status` field (also updates related phases) |
| DELETE | `/api/tasks/:id` | Delete a task |

### Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List all employees |
| POST | `/api/employees` | Add a new employee (`{ "name": "John Doe" }`) |
| DELETE | `/api/employees/:id` | Delete employee (cascade removes assignments) |

### KPI

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpi` | Retrieve KPI aggregates (summary, status, topics, employee performance) |

### Phases & Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpi/workload-monthly` | Retrieve monthly workload per employee (query params `year` & `month`) |
| GET | `/api/tasks/:taskId/phases` | List phases for a specific task |
| POST | `/api/tasks/:taskId/phases` | Replace all phases for a task (expects `phases` array) |
| PATCH | `/api/phases/:id` | Update a single phase (status, dates, assignees, etc.) |

### Work Hours & Costs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/work-hours` | Record or update work hours for an employee on a task (`employee_id`, `task_id`, `date`, `hours`, `note`) |
| GET | `/api/work-hours/:employeeId?year=&month=` | Retrieve logged work‑hours for an employee filtered by year/month |
| GET | `/api/costs` *(HR protected)* | Get yearly cost overview per employee – includes annual gross, logged hours, overtime, dynamic hourly rates, and cost history |
| POST | `/api/costs/:employeeId` *(HR protected)* | Add a new annual cost record for an employee (`annual_gross`, `valid_from`) |

### Overtime

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/costs/:employeeId/overtime?year=` *(HR protected)* | List overtime hours per month for a given year |
| POST | `/api/costs/:employeeId/overtime` *(HR protected)* | Record or update overtime hours (`year`, `month`, `amount` or `hours`) |

### Task Finances

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/task-finances?year=` *(HR protected)* | Retrieve revenue per task for a given year and aggregated work‑hours per employee |
| POST | `/api/task-finances/:taskId` *(HR protected)* | Set or update revenue for a task (`revenue`) |

### User Management & Audit *(HR Only)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all registered accounts |
| POST | `/api/users` | Create a new user with bcrypt-hashed password |
| PATCH | `/api/users/:id` | Update user details (name, role, password, status) |
| GET | `/api/audit-logs` | Retrieve recent activity logs (Who, What, When, IP) |

---

## 🌟 Features

- **Drag-and-drop Kanban board** (New → In Process → Blocked → Done)
- **Phase templates** for reusable workflows.
- **KPI Dashboards & Gantt Charts** for project visualization.
- **Time-tracking (start/stop)** for fine-grained work logging.
- **Secure Role-Based Access** via JWT with individual accounts (`standard` & `hr` roles) stored in the database.
- **Bcrypt Password Protection** for all user credentials.
- **Audit Logging** – Complete traceability for all creates, edits, and deletes with a dedicated admin viewer.
- **Private HR Finance Dashboard** for tracking work hours, overtime, employee costs, and company overheads.
- **Financial Module (Fatturato)** tracking client revenue, invoices, and remaining budgets.
- **Containerised** one-click deployment with Docker Compose.

---

## 📝 Project Documentation & Analysis

For current code vulnerabilities, missing features, and roadmaps, please refer to:
- `PROJECT_ANALYSIS_AND_SHORTCOMINGS.md` - Details about missing UI elements for financials and authentication fragmentation.
- `SECURITY_AND_CODE_IMPROVEMENT_ROADMAP.md` - Overall system health and security improvement roadmap.
- `COMPREHENSIVE_SECURITY_AND_CODE_REVIEW.md` - Detailed breakdown of backend vulnerabilities.

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/awesome-feature`
3. Make your changes and add tests if applicable.
4. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** – see the [`LICENSE`](LICENSE) file for details.

---

*Happy coding!*
