-- ==============================================================================
-- 1. CORE TABLES (Temel Tablolar)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY, 
  value TEXT NOT NULL
); 
INSERT INTO settings (key, value) VALUES ('max_capacity', '250') ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 2. TASKS (Görevler) 
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  topic VARCHAR(100),
  label VARCHAR(100),
  deadline DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'process', 'blocked', 'done')),
  position INTEGER DEFAULT 0,
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  estimated_hours NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_timeframes CHECK (
    (planned_start IS NULL OR planned_end IS NULL OR planned_start <= planned_end) AND
    (actual_start IS NULL OR actual_end IS NULL OR actual_start <= actual_end)
  )
);
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==============================================================================
-- 3. TASK RELATIONS (Ara Tablolar)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, employee_id)
);

CREATE TABLE IF NOT EXISTS task_topics (
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL,
  PRIMARY KEY (task_id, topic)
);

CREATE TABLE IF NOT EXISTS task_time_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_time_log CHECK (ended_at IS NULL OR started_at <= ended_at)
);

-- ==============================================================================
-- 4. PHASES & TEMPLATES (Aşamalar ve Şablonlar)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS phase_templates (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_phases (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  estimated_hours NUMERIC(5,1),
  topic_source VARCHAR(100), 
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'done')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase_assignees (
  phase_id INTEGER REFERENCES task_phases(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  estimated_hours NUMERIC(5,1),
  PRIMARY KEY (phase_id, employee_id)
); 

CREATE TABLE IF NOT EXISTS phase_assignee_monthly_hours (
  phase_id INTEGER REFERENCES task_phases(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  PRIMARY KEY (phase_id, employee_id, year, month)
);

-- ==============================================================================
-- 5. FINANCIALS & COSTS (Maliyet ve Finans Tabloları)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS employee_costs (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  annual_gross NUMERIC(10,2) NOT NULL,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_work_hours (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(4,1) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT employee_work_hours_emp_task_date_key UNIQUE(employee_id, task_id, date)
);

CREATE TABLE IF NOT EXISTS employee_overtime_costs (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, year, month)
);

CREATE TABLE IF NOT EXISTS task_revenues (
  task_id INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_label ON tasks(label);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_employee_id ON task_assignees(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_topics_task_id ON task_topics(task_id);

CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_employee_id ON task_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_started_at ON task_time_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_ended_at ON task_time_logs(ended_at);

CREATE INDEX IF NOT EXISTS idx_task_phases_task_id ON task_phases(task_id);

CREATE INDEX IF NOT EXISTS idx_work_hours_employee ON employee_work_hours(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_hours_date ON employee_work_hours(date);
CREATE INDEX IF NOT EXISTS idx_work_hours_task_id ON employee_work_hours(task_id); -- Finans API'sini hızlandırır

CREATE INDEX IF NOT EXISTS idx_employee_costs_employee_id ON employee_costs(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_overtime_emp_year ON employee_overtime_costs(employee_id, year);

-- ==============================================================================
-- 7. SEED DATA (Başlangıç Verileri)
-- ==============================================================================

INSERT INTO employees (name) VALUES
  ('Marco R.'), ('Sofia B.'), ('Luca M.'), ('Giulia F.'), ('Andrea C.')
ON CONFLICT DO NOTHING;

INSERT INTO phase_templates (topic, name, position) VALUES
  ('MEP', 'Feasibility study', 0), ('MEP', 'Due Diligence', 1), ('MEP', 'Preliminary design', 2), ('MEP', 'Final design', 3), ('MEP', 'Executive design', 4), ('MEP', 'BIM modelling', 5), ('MEP', 'Work supervision', 6), ('MEP', 'Functional tests', 7),
  ('ENERGY', 'APE', 0), ('ENERGY', 'Energy diagnosis', 1),
  ('SUSTAINABILITY', 'LEED', 0), ('SUSTAINABILITY', 'BREEAM', 1), ('SUSTAINABILITY', 'WELL', 2), ('SUSTAINABILITY', 'WIREDSCORE', 3), ('SUSTAINABILITY', 'CRREM', 4), ('SUSTAINABILITY', 'EU Taxonomy', 5), ('SUSTAINABILITY', 'CAM', 6), ('SUSTAINABILITY', 'LCA', 7), ('SUSTAINABILITY', 'GRESB', 8), ('SUSTAINABILITY', 'FITWEL', 9),
  ('ACUSTIC', 'Preliminary design', 0), ('ACUSTIC', 'Final design', 1), ('ACUSTIC', 'Executive design', 2), ('ACUSTIC', 'Work supervision', 3), ('ACUSTIC', 'Acustic Tests', 4), ('ACUSTIC', 'Acustic Tests assistance', 5),
  ('VVF', 'Preliminary design', 0), ('VVF', 'Final design', 1), ('VVF', 'Executive design', 2), ('VVF', 'Work supervision', 3), ('VVF', 'VVF Tests', 4), ('VVF', 'VVF Tests assistance', 5),
  ('STRUCTURE', 'Preliminary design', 0), ('STRUCTURE', 'Final design', 1), ('STRUCTURE', 'Executive design', 2), ('STRUCTURE', 'Work supervision', 3), ('STRUCTURE', 'Structural Tests', 4), ('STRUCTURE', 'Structural Tests assistance', 5),
  ('GEOTHERMAL', 'Preliminary design', 0), ('GEOTHERMAL', 'Final design', 1), ('GEOTHERMAL', 'Executive design', 2), ('GEOTHERMAL', 'Work supervision', 3), ('GEOTHERMAL', 'Geothermal Tests', 4),
  ('HYDRAULIC INVARIANCE', 'Hydraulic invariance', 0),
  ('CONTINUOUS COMMISSIONING', 'Development of a virtual simulation of the plant building to train the algorithm', 0), ('CONTINUOUS COMMISSIONING', 'Development and release of the AI-Eco algorithm adapted to the specific project', 1), ('CONTINUOUS COMMISSIONING', 'Continuous Commissioning of the AI-Eco algorithm – Ongoing monitoring activities', 2)
ON CONFLICT DO NOTHING;