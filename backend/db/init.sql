-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tasks Table (Çalışan ataması yok, sadece görev detayları)
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  topic VARCHAR(100),
  deadline DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'process', 'blocked', 'done')),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Junction Table (Ara Tablo)- Çoklu çalışan ataması için
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
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY, 
  value TEXT NOT NULL
); 
INSERT INTO settings (key, value) VALUES ('max_capacity', '250')  ON CONFLICT DO NOTHING;

-- Index for querying tasks by status
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Index for querying tasks by deadline
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

-- Index for querying task_assignees by task_id (optimizes JOINs)
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);

-- Index for querying task_assignees by employee_id (optimizes employee-based queries)
CREATE INDEX IF NOT EXISTS idx_task_assignees_employee_id ON task_assignees(employee_id);

CREATE INDEX IF NOT EXISTS idx_task_topics_task_id ON task_topics(task_id); -- Yeni tablo için index

ALTER TABLE tasks
  ADD COLUMN planned_start TIMESTAMPTZ,
  ADD COLUMN planned_end TIMESTAMPTZ,
  ADD COLUMN actual_start TIMESTAMPTZ,
  ADD COLUMN actual_end TIMESTAMPTZ;
ALTER TABLE tasks
  ADD CONSTRAINT chk_timeframes CHECK (
    (planned_start IS NULL OR planned_end IS NULL OR planned_start <= planned_end) AND
    (actual_start IS NULL OR actual_end IS NULL OR actual_start <= actual_end)
  );
ALTER TABLE tasks ADD COLUMN estimated_hours NUMERIC(5,1);

ALTER TABLE tasks ADD COLUMN label VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_tasks_label ON tasks(label);


-- Auto-update updated_at Trigger
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
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_employee_id ON task_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_started_at ON task_time_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_ended_at ON task_time_logs(ended_at);


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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  topic_source VARCHAR(100), 
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'done'))
);
CREATE INDEX IF NOT EXISTS idx_task_phases_task_id ON task_phases(task_id);

ALTER TABLE task_phases ADD COLUMN note TEXT;
-- ── Phase Templates ──────────────────────────────────────────────
INSERT INTO phase_templates (topic, name, position) VALUES
  -- MEP
  ('MEP', 'Feasibility study', 0),
  ('MEP', 'Due Diligence', 1),
  ('MEP', 'Preliminary design', 2),
  ('MEP', 'Final design', 3),
  ('MEP', 'Executive design', 4),
  ('MEP', 'BIM modelling', 5),
  ('MEP', 'Work supervision', 6),
  ('MEP', 'Functional tests', 7),

  -- ENERGY
  ('ENERGY', 'APE', 0),
  ('ENERGY', 'Energy diagnosis', 1),

  -- SUSTAINABILITY
  ('SUSTAINABILITY', 'LEED', 0),
  ('SUSTAINABILITY', 'BREEAM', 1),
  ('SUSTAINABILITY', 'WELL', 2),
  ('SUSTAINABILITY', 'WIREDSCORE', 3),
  ('SUSTAINABILITY', 'CRREM', 4),
  ('SUSTAINABILITY', 'EU Taxonomy', 5),
  ('SUSTAINABILITY', 'CAM', 6),
  ('SUSTAINABILITY', 'LCA', 7),
  ('SUSTAINABILITY', 'GRESB', 8),
  ('SUSTAINABILITY', 'FITWEL', 9),

  -- ACUSTIC
  ('ACUSTIC', 'Preliminary design', 0),
  ('ACUSTIC', 'Final design', 1),
  ('ACUSTIC', 'Executive design', 2),
  ('ACUSTIC', 'Work supervision', 3),
  ('ACUSTIC', 'Acustic Tests', 4),
  ('ACUSTIC', 'Acustic Tests assistance', 5),

  -- VVF (Fire Safety)
  ('VVF', 'Preliminary design', 0),
  ('VVF', 'Final design', 1),
  ('VVF', 'Executive design', 2),
  ('VVF', 'Work supervision', 3),
  ('VVF', 'VVF Tests', 4),
  ('VVF', 'VVF Tests assistance', 5),

  -- STRUCTURE
  ('STRUCTURE', 'Preliminary design', 0),
  ('STRUCTURE', 'Final design', 1),
  ('STRUCTURE', 'Executive design', 2),
  ('STRUCTURE', 'Work supervision', 3),
  ('STRUCTURE', 'Structural Tests', 4),
  ('STRUCTURE', 'Structural Tests assistance', 5),

  -- GEOTHERMAL
  ('GEOTHERMAL', 'Preliminary design', 0),
  ('GEOTHERMAL', 'Final design', 1),
  ('GEOTHERMAL', 'Executive design', 2),
  ('GEOTHERMAL', 'Work supervision', 3),
  ('GEOTHERMAL', 'Geothermal Tests', 4),

  -- HYDRAULIC INVARIANCE
  ('HYDRAULIC INVARIANCE', 'Hydraulic invariance', 0),

  -- CONTINUOUS COMMISSIONING
  ('CONTINUOUS COMMISSIONING', 'Development of a virtual simulation of the plant building to train the algorithm', 0),
  ('CONTINUOUS COMMISSIONING', 'Development and release of the AI-Eco algorithm adapted to the specific project', 1),
  ('CONTINUOUS COMMISSIONING', 'Continuous Commissioning of the AI-Eco algorithm – Ongoing monitoring activities', 2)
ON CONFLICT DO NOTHING;



ALTER TABLE task_phases ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,1);

CREATE TABLE IF NOT EXISTS phase_assignees (
  phase_id INTEGER REFERENCES task_phases(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (phase_id, employee_id),
  estimated_hours NUMERIC(5,1)
); 


CREATE OR REPLACE FUNCTION update_task_timeframes()
RETURNS TRIGGER AS $$
BEGIN
  -- Güncellenen veya eklenen zaman kaydına göre görev zamanlarını güncelle
  IF NEW.status = 'process' AND OLD.status != 'process' AND NEW.actual_start IS NULL THEN
    NEW.actual_start = NOW();
  END IF;
  IF NEW.status = 'done' AND OLD.status != 'done' AND NEW.actual_end IS NULL THEN
    NEW.actual_end = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tasks_timeframe_update ON tasks;
CREATE TRIGGER tasks_timeframe_update
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_task_timeframes();

-- Seed Employees
INSERT INTO employees (name) VALUES
  ('Marco R.'),
  ('Sofia B.'),
  ('Luca M.'),
  ('Giulia F.'),
  ('Andrea C.')
ON CONFLICT DO NOTHING;

-- Sequence (Otomatik artan ID) ayarını güncelle
-- Manuel ID verdiğimiz için sequence'i en yüksek ID'nin bir fazlasına ayarlamalıyız.
SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));