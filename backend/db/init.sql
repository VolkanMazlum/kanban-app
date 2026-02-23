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


-- Index for querying tasks by status
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Index for querying tasks by deadline
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

-- Index for querying task_assignees by task_id (optimizes JOINs)
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);

-- Index for querying task_assignees by employee_id (optimizes employee-based queries)
CREATE INDEX IF NOT EXISTS idx_task_assignees_employee_id ON task_assignees(employee_id);


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

-- Seed Tasks (Sadece görev detayları, kişi ataması yok!)
INSERT INTO tasks (id, title, description, topic, deadline, status, position) VALUES
  (1, 'MV Panel Installation', 'Medium voltage switchgear installation at Site A', 'Electrical Systems', '2026-03-10', 'process', 1),
  (2, 'Pump Station Inspection', 'Quarterly inspection of main pump station units', 'Mechanical Engineering', '2026-03-05', 'done', 1),
  (3, 'Foundation Approval Docs', 'Submit structural calculations for client approval', 'Civil & Structural', '2026-02-28', 'blocked', 1),
  (4, 'HVAC Commissioning – Block C', 'Final commissioning of HVAC system, building C', 'HVAC & Plumbing', '2026-03-20', 'new', 1),
  (5, 'Project Schedule Update', 'Update master Gantt chart for Q2 milestones', 'Project Management', '2026-03-01', 'process', 2),
  (6, 'ISO 9001 Internal Audit', 'Conduct internal quality audit for ISO renewal', 'Quality Assurance', '2026-04-01', 'new', 2),
  (7, 'Site Safety Walkthrough', 'Weekly HSE inspection – Site B', 'HSE', '2026-02-22', 'done', 2),
  (8, 'Subcontractor Evaluation', 'Evaluate 3 new subcontractors for civil works', 'Procurement', '2026-03-15', 'new', 3),
  (9, 'Cable Tray Installation', 'Install cable trays on floors 2-5', 'Electrical Systems', '2026-03-08', 'process', 3),
  (10, 'As-Built Drawing Update', 'Update all as-built drawings after scope change', 'Documentation', '2026-03-12', 'blocked', 2),
  (11, 'Generator Load Test', 'FAT load bank test for 500kVA emergency generator', 'Testing & Commissioning', '2026-03-25', 'new', 4),
  (12, 'SCADA Config Review', 'Review and validate SCADA configuration v2.1', 'IT & Automation', '2026-04-05', 'new', 3)
ON CONFLICT DO NOTHING;

-- Seed Task Assignees (Atamaları Şimdi Yapıyoruz!)
-- Mantık: (Görev ID, Çalışan ID)
INSERT INTO task_assignees (task_id, employee_id) VALUES
  (1, 1),       -- Görev 1, Marco'ya
  (2, 2),       -- Görev 2, Sofia'ya
  (3, 3),       -- Görev 3, Luca'ya
  (4, 4), (4, 5), -- Görev 4 (HVAC), hem Giulia hem Andrea'ya (Çoklu Atama)
  (5, 5),       -- Görev 5, Andrea'ya
  (6, 2), (6, 3), -- Görev 6, Sofia ve Luca'ya (Çoklu Atama)
  (7, 1),
  (8, 3),
  (9, 4),
  (10, 1), (10, 5), -- Görev 10, Marco ve Andrea'ya
  (11, 1),
  (12, 2)
ON CONFLICT DO NOTHING;
-- Seed Task Time Logs (process statusundaki görevler için)
INSERT INTO task_time_logs (task_id, employee_id, started_at) VALUES
  (1, 1, NOW()),   -- MV Panel Installation, Marco
  (5, 5, NOW()),   -- Project Schedule Update, Andrea
  (9, 4, NOW())    -- Cable Tray Installation, Giulia
ON CONFLICT DO NOTHING;

-- Sequence (Otomatik artan ID) ayarını güncelle
-- Manuel ID verdiğimiz için sequence'i en yüksek ID'nin bir fazlasına ayarlamalıyız.
SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));