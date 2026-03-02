# 📋 ProjeBoard — Kanban Yönetim Sistemi

A complete, self‑hosted Kanban board for internal project management, built with a **React + Vite** frontend, **Node.js + Express** backend, and **PostgreSQL** database. All services are containerised and orchestrated with Docker Compose.

---

## 🏗️ Architecture

```
kanban-app/
├── docker-compose.yml          # Orchestrates all services
├── backend/                    # Express API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Server entry point
│       ├── auth.js             # Basic auth middleware
│       ├── employees.js        # Employee CRUD
│       ├── kpi.js              # KPI endpoint
│       ├── phases.js           # Phase & template logic
│       ├── settings.js         # (future config)
│       ├── tasks.js            # Full task CRUD with phases & topics
│       ├── timeLogs.js         # Time‑tracking endpoints
│       ├── validation.js       # Zod schemas
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
│       │   ├── GanttChart.jsx
│       │   ├── KPIDashboard.jsx
│       │   ├── TaskCard.jsx
│       │   ├── TaskModal.jsx
│       │   └── …
│       └── constants/
│           └── index.js
└── .env                        # Shared env vars (Docker secrets)
```

---

## 🚀 Installation & Running

### Prerequisites
- **Docker Desktop** (Windows/macOS/Linux) – provides Docker Engine & Compose
- **Git** – to clone the repository

### Quick Start (Docker)
```bash
# Clone the repository (or unzip the archive you received)
git clone <repo‑url>
cd kanban-app

# Create a .env file (see .env.example for required keys)
cp .env.example .env
# Edit .env with your preferred credentials

# Build and start all services
docker compose up --build -d
```
The stack will be available at:
- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000/api>
- PostgreSQL: `localhost:5432` (use the credentials from `.env`)

### Development (without Docker)
#### Backend
```bash
cd backend
npm install
npm run dev   # http://localhost:4000
```
#### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (Vite dev server)
```
> **Tip:** The backend respects the `FRONTEND_URL` env var for CORS; set it to the Vite dev URL when developing locally.

---

## ⚙️ Environment Variables
The project uses a shared `.env` file (mounted into each container). Required keys:
```
# Docker / PostgreSQL
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB

# Backend
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@db:5432/POSTGRES_DB
PORT=4000
AUTH_USERNAME   # Basic‑auth username
AUTH_PASSWORD   # Basic‑auth password
FRONTEND_URL   # Used by CORS middleware

# Optional – for local dev (override Docker values)
```
> **Security note:** Never commit real passwords to source control; add `.env` to `.gitignore` (already done).

---

## 📡 API Endpoints
All endpoints are prefixed with `/api` and require **Basic Auth** (see `backend/src/auth.js`).

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks, filter with `?assignee_id=` or `?status=` |
| GET | `/api/tasks/:id` | Get single task with topics, assignees & phases |
| POST | `/api/tasks` | Create a task (body includes `phases` array) |
| PUT | `/api/tasks/:id` | Full update (including `phases`) |
| PATCH | `/api/tasks/:id/status` | Update only the `status` field (also updates related phases) |
| DELETE | `/api/tasks/:id` | Delete a task |

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List all employees |
| POST | `/api/employees` | Add a new employee (body: `{ "name": "John Doe" }`) |
| DELETE | `/api/employees/:id` | Delete employee (cascade removes assignments) |

### KPI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kpi` | Retrieve KPI aggregates for the board |

### Phases (Templates & Task‑specific)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/phase-templates` | Get reusable phase templates grouped by topic |
| GET | `/api/tasks/:taskId/phases` | List phases for a specific task |
| POST | `/api/tasks/:taskId/phases` | Replace all phases for a task (expects `phases` array) |
| PATCH | `/api/phases/:id` | Update a single phase (status, dates, assignees, etc.) |

### Time Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/time-logs` | List **all** time logs |
| GET | `/api/tasks/:taskId/time-logs` | Logs for a specific task |
| GET | `/api/employees/:employeeId/time-logs` | Logs for a specific employee |
| POST | `/api/time-logs/start` | Start a new log (sets `started_at` to now) |
| PATCH | `/api/time-logs/:id/stop` | Stop an active log (sets `ended_at` to now) |
| POST | `/api/time-logs` | Create a complete log with both timestamps |
| PUT | `/api/time-logs/:id` | Full update of a log |
| DELETE | `/api/time-logs/:id` | Delete a log |

---

## ✨ Features
- **Drag‑and‑drop Kanban board** with columns: New → In Process → Blocked → Done
- **Phase templates** for reusable workflows (e.g., design → development → review)
- **Employee assignment** at both task and phase levels
- **KPI dashboard** showing total tasks, completed tasks, overdue tasks, etc.
- **Time‑tracking** (start/stop) for fine‑grained work logging
- **Persistent storage** via PostgreSQL (Docker volume)
- **Containerised** – one‑click deployment with Docker Compose
- **Basic authentication** for API security (username/password from `.env`)
- **Development mode** with hot‑reload (`nodemon` & Vite)

---

## 🏢 Production Deployment (to a remote server)
```bash
# Copy the repo to the server (SSH/SCP)
scp -r kanban-app/ user@myserver:/opt/kanban-app

# SSH into the server
ssh user@myserver
cd /opt/kanban-app

# Adjust .env for production secrets
nano .env   # set strong passwords, change PORT if needed

# Start containers in detached mode
docker compose up -d --build
```
The application will be reachable at `http://<server-ip>:3000`.

---

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Make your changes
4. Ensure the backend tests (if added) pass and the app still builds
5. Open a Pull Request describing your changes

---

## 📄 License
This project is licensed under the **MIT License** – see the `LICENSE` file for details.

---

*Happy coding!*
