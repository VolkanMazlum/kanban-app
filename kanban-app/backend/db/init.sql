-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  topic VARCHAR(100),
  assignee_ids INTEGER[] DEFAULT '{}', -- TEKİL ID YERİNE DİZİ (ARRAY) KULLANIYORUZ
  deadline DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'process', 'blocked', 'done')),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı yeniden oluştururken hata vermemesi için önce siliyoruz
DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed employees
INSERT INTO employees (name) VALUES
  ('Marco R.'),
  ('Sofia B.'),
  ('Luca M.'),
  ('Giulia F.'),
  ('Andrea C.')
ON CONFLICT DO NOTHING;

-- Seed tasks (TEKSER SRL - Italian Engineering Company)
-- ARRAY formatı ile atamalar güncellendi
INSERT INTO tasks (title, description, topic, assignee_ids, deadline, status, position) VALUES
  ('MV Panel Installation',        'Medium voltage switchgear installation at Site A',   'Electrical Systems',      ARRAY[1],    '2026-03-10', 'process', 1),
  ('Pump Station Inspection',      'Quarterly inspection of main pump station units',    'Mechanical Engineering',  ARRAY[2],    '2026-03-05', 'done',    1),
  ('Foundation Approval Docs',     'Submit structural calculations for client approval', 'Civil & Structural',      ARRAY[3],    '2026-02-28', 'blocked', 1),
  ('HVAC Commissioning – Block C', 'Final commissioning of HVAC system, building C',     'HVAC & Plumbing',         ARRAY[4, 5], '2026-03-20', 'new',     1),
  ('Project Schedule Update',      'Update master Gantt chart for Q2 milestones',        'Project Management',      ARRAY[5],    '2026-03-01', 'process', 2),
  ('ISO 9001 Internal Audit',      'Conduct internal quality audit for ISO renewal',     'Quality Assurance',       ARRAY[2, 3], '2026-04-01', 'new',     2),
  ('Site Safety Walkthrough',      'Weekly HSE inspection – Site B',                     'HSE',                     ARRAY[1],    '2026-02-22', 'done',    2),
  ('Subcontractor Evaluation',     'Evaluate 3 new subcontractors for civil works',      'Procurement',             ARRAY[3],    '2026-03-15', 'new',     3),
  ('Cable Tray Installation',      'Install cable trays on floors 2-5',                  'Electrical Systems',      ARRAY[4],    '2026-03-08', 'process', 3),
  ('As-Built Drawing Update',      'Update all as-built drawings after scope change',    'Documentation',           ARRAY[1, 5], '2026-03-12', 'blocked', 2),
  ('Generator Load Test',          'FAT load bank test for 500kVA emergency generator',  'Testing & Commissioning', ARRAY[1],    '2026-03-25', 'new',     4),
  ('SCADA Config Review',          'Review and validate SCADA configuration v2.1',       'IT & Automation',         ARRAY[2],    '2026-04-05', 'new',     3)
ON CONFLICT DO NOTHING;