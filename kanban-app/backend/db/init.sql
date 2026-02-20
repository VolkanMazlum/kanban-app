-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tasks Table (DİKKAT: Artık assignee_id veya assignee_ids YOK!)
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

-- 3. Junction Table (Ara Tablo - Profesyonel Çözüm)
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

-- ==========================================
-- SEED DATA (Örnek Veriler)
-- ==========================================

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

-- Sequence (Otomatik artan ID) ayarını güncelle
-- Manuel ID verdiğimiz için sequence'i en yüksek ID'nin bir fazlasına ayarlamalıyız.
SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));