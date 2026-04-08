-- ==============================================================================
-- 1. CORE TABLES (Temel Tablolar)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  position VARCHAR(100) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  category VARCHAR(20) DEFAULT 'internal' CHECK (category IN ('internal', 'consultant')),
  hr_details JSONB DEFAULT '{}'
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
-- CLIENTS 
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ragione_sociale VARCHAR(255),
  vat_number VARCHAR(100),
  codice_fiscale VARCHAR(100),
  codice_univoco VARCHAR(100),
  codice_ateco VARCHAR(100),
  codice_inarcassa VARCHAR(100),
  contact_email VARCHAR(255),
  phone VARCHAR(50),
  fax VARCHAR(50),
  address TEXT,
  localita VARCHAR(100),
  cap VARCHAR(10),
  province VARCHAR(100),
  stato VARCHAR(100),
  contabilita_prefix VARCHAR(20), -- sig/sig.ra
  contabilita_name VARCHAR(255),
  contabilita_email VARCHAR(255),
  contabilita_phone VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ==============================================================================
-- 8. FATTURATO (3-Tier Hiyerarşik Yapı: Commessa -> Client -> Lines)
-- ==============================================================================


-- 1. KATMAN: Ana İş/Proje (Commessa)
CREATE TABLE IF NOT EXISTS commesse (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  name VARCHAR(255),
  comm_number VARCHAR(255) UNIQUE, -- Örn: 25-003
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. KATMAN: O işe bağlı Müşteriler (Clients)
CREATE TABLE IF NOT EXISTS commessa_clients (
  id SERIAL PRIMARY KEY,
  commessa_id INTEGER NOT NULL REFERENCES commesse(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  n_cliente VARCHAR(255),          -- Örn: 00, 01, 02
  n_ordine VARCHAR(1000),           
  preventivo VARCHAR(255),        
  ordine TEXT,                    
  n_ordine_zucchetti VARCHAR(255),
  voce_bilancio VARCHAR(255)
);

-- 3. KATMAN: O müşteriye bağlı Aktiviteler (Lines)
CREATE TABLE IF NOT EXISTS fatturato_lines (
  id SERIAL PRIMARY KEY,
  commessa_client_id INTEGER NOT NULL REFERENCES commessa_clients(id) ON DELETE CASCADE,
  attivita TEXT,          -- "progettazione preliminare"
  descrizione TEXT,               
  valore_ordine NUMERIC(12,2) DEFAULT 0,
  fatturato_amount NUMERIC(12,2) DEFAULT 0,
  rimanente_probabile NUMERIC(12,2) DEFAULT 0,  
  proforma NUMERIC(12,2) DEFAULT 0,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER fatturato_lines_updated_at
BEFORE UPDATE ON fatturato_lines
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. KATMAN: Ödeme Takvimi (Fatturato Ordini - Percentage-based installments per attivita)
CREATE TABLE IF NOT EXISTS fatturato_ordini (
  id SERIAL PRIMARY KEY,
  fatturato_line_id INTEGER NOT NULL REFERENCES fatturato_lines(id) ON DELETE CASCADE,
  label VARCHAR(255),           -- e.g. "SAL 1", "Acconto", "Saldo finale"
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,  -- e.g. 30.00 = 30% of valore_ordine
  expected_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. KATMAN: Gerçekleşen Faturalar (Realized Billing/Revenue History)
CREATE TABLE IF NOT EXISTS fatturato_realized (
  id SERIAL PRIMARY KEY,
  fatturato_line_id INTEGER NOT NULL REFERENCES fatturato_lines(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. KATMAN: Proforma Entries (Predicted Billing)
CREATE TABLE IF NOT EXISTS fatturato_proforma (
  id SERIAL PRIMARY KEY,
  fatturato_line_id INTEGER NOT NULL REFERENCES fatturato_lines(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatturato_proforma_line ON fatturato_proforma(fatturato_line_id);

CREATE INDEX IF NOT EXISTS idx_commesse_task ON commesse(task_id);
CREATE INDEX IF NOT EXISTS idx_commessa_clients_comm ON commessa_clients(commessa_id);
CREATE INDEX IF NOT EXISTS idx_fatturato_ordini_line ON fatturato_ordini(fatturato_line_id);
CREATE INDEX IF NOT EXISTS idx_fatturato_realized_line ON fatturato_realized(fatturato_line_id);
 
  -- USER EXTRA COSTS (Travel, tickets, etc. linked to employee and task)
  CREATE TABLE IF NOT EXISTS employee_extra_costs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_employee_extra_costs_emp ON employee_extra_costs(employee_id);
  CREATE INDEX IF NOT EXISTS idx_employee_extra_costs_task ON employee_extra_costs(task_id);
  CREATE INDEX IF NOT EXISTS idx_employee_extra_costs_date ON employee_extra_costs(date);
 
  -- 8. FATTURATO SAL & OBIETTIVI
  CREATE TABLE IF NOT EXISTS fatturato_sal (
    id SERIAL PRIMARY KEY,
    fatturato_line_id INTEGER REFERENCES fatturato_lines(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    value NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('sbloccato', 'in_progress')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS fatturato_obiettivi (
    id SERIAL PRIMARY KEY,
    fatturato_line_id INTEGER REFERENCES fatturato_lines(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    period VARCHAR(20) NOT NULL, -- 'T2', 'T3', 'T4'
    ordinante_val NUMERIC(12,2) DEFAULT 0,
    acquisizioni_val NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fatturato_line_id, year, period)
  );

  CREATE INDEX IF NOT EXISTS idx_fatturato_sal_line ON fatturato_sal(fatturato_line_id);
  CREATE INDEX IF NOT EXISTS idx_fatturato_obiettivi_line ON fatturato_obiettivi(fatturato_line_id);

 -- ==============================================================================
-- 7. USERS & AUDIT LOGS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (role IN ('standard', 'hr')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_username VARCHAR(255),
  user_name VARCHAR(150),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ==============================================================================
-- 8. SEED DATA (Başlangıç Verileri)
-- ==============================================================================

INSERT INTO phase_templates (topic, name, position) VALUES
  -- MEP
  ('MEP', 'Studio di Fattibilità', 0), 
  ('MEP', 'Due Diligence', 1), 
  ('MEP', 'Progetto Preliminare', 2), 
  ('MEP', 'Progetto Definitivo per Permessi', 3), 
  ('MEP', 'Progetto Definitivo', 4), 
  ('MEP', 'Progetto Definitivo per Appalto', 5), 
  ('MEP', 'Progetto Esecutivo per Appalto', 6), 
  ('MEP', 'BIM modelling', 7), 
  ('MEP', 'Direzione lavori Impianti', 8), 
  ('MEP', 'Assistenza ai Collaudi MEP', 9), 
  ('MEP', 'Collaudi tecnico-funzionali MEP', 10),

  -- ENERGY
  ('ENERGY', 'APE', 0), 
  ('ENERGY', 'Legge 10/91', 1), 
  ('ENERGY', 'Diagnosi Energetica', 2),

  -- SUSTAINABILITY (LEED)
  ('SUSTAINABILITY', 'LEED', 0),
  ('SUSTAINABILITY', 'LEED - Pre-Assessment', 1),
  ('SUSTAINABILITY', 'LEED - Fase di progettazione', 2),
  ('SUSTAINABILITY', 'LEED - Fase di costruzione', 3),
  ('SUSTAINABILITY', 'LEED - CxA Base', 4),
  ('SUSTAINABILITY', 'LEED - CxA Avanzato impianti', 5),
  ('SUSTAINABILITY', 'LEED - CxA Avanzato involucro', 6),
  ('SUSTAINABILITY', 'LEED - Daylighting', 7),
  ('SUSTAINABILITY', 'LEED - Relazione di processo integrato', 8),
  ('SUSTAINABILITY', 'LEED - Analisi del sito', 9),
  ('SUSTAINABILITY', 'LEED - Consulenza acustica', 10),
  ('SUSTAINABILITY', 'LEED - Analisi LCA materiali', 11),
  
  -- SUSTAINABILITY (BREEAM)
  ('SUSTAINABILITY', 'BREEAM', 12),
  ('SUSTAINABILITY', 'BREEAM - Design stage', 13),
  ('SUSTAINABILITY', 'BREEAM - Construction stage', 14),
  ('SUSTAINABILITY', 'BREEAM - Post Construction stage', 15),
  ('SUSTAINABILITY', 'BREEAM - Suitable Qualified Ecologist (LE04/05)', 16),
  ('SUSTAINABILITY', 'BREEAM - Modellazione L10 + energia di processo (ENE01)', 17),
  ('SUSTAINABILITY', 'BREEAM - Life Cycle Assessment dell''edificio (MAT01)', 18),
  ('SUSTAINABILITY', 'BREEAM - Elemental Life Cycle Cost dell''edificio (MAN02)', 19),
  ('SUSTAINABILITY', 'BREEAM - Component Level LCC Plan (MAN02)', 20),
  ('SUSTAINABILITY', 'BREEAM - Analisi flussi verticali (ENE06)', 21),
  ('SUSTAINABILITY', 'BREEAM - Commissioning e Handover (MAN04)', 22),
  ('SUSTAINABILITY', 'BREEAM - Commissioning dell''involucro (MAN04)', 23),
  ('SUSTAINABILITY', 'BREEAM - Seasonal Commissioning e Aftercare (MAN05)', 24),
  ('SUSTAINABILITY', 'BREEAM - Comfort e adattabilità camb. climatici (HEA04)', 25),
  ('SUSTAINABILITY', 'BREEAM - Risk Assessment (HEA07)', 26),
  ('SUSTAINABILITY', 'BREEAM - Tempi ritorno precipitazioni e gestione acque (POL03)', 27),
  ('SUSTAINABILITY', 'BREEAM - Material Efficiency Analysis (MAT06)', 28),
  ('SUSTAINABILITY', 'BREEAM - Adattamento al cambiamento climatico (WST05)', 29),
  ('SUSTAINABILITY', 'BREEAM - Passive Design Analysis (ENE04)', 30),

  -- SUSTAINABILITY (WELL)
  ('SUSTAINABILITY', 'WELL', 31),
  ('SUSTAINABILITY', 'WELL - Pre-Assessment', 32),
  ('SUSTAINABILITY', 'WELL - Fase di progettazione', 33),
  ('SUSTAINABILITY', 'WELL - Fase di costruzione', 34),
  ('SUSTAINABILITY', 'WELL - Fase di performance verification', 35),
  ('SUSTAINABILITY', 'WELL - Commissioning dell''involucro', 36),
  ('SUSTAINABILITY', 'WELL - Daylighting', 37),
  ('SUSTAINABILITY', 'WELL - PTA (Performance Test Agent)', 38),
  ('SUSTAINABILITY', 'WELL - WELL Performance Rating', 39),
  ('SUSTAINABILITY', 'WELL - monitoraggio e ricertificazione WELL', 40),

  -- SUSTAINABILITY (WIREDSCORE)
  ('SUSTAINABILITY', 'WIREDSCORE', 41),
  ('SUSTAINABILITY', 'WIREDSCORE - Pre-Assessment', 42),
  ('SUSTAINABILITY', 'WIREDSCORE - Consulenza per lvl certified', 43),
  ('SUSTAINABILITY', 'WIREDSCORE - Incremento per lvl silver', 44),
  ('SUSTAINABILITY', 'WIREDSCORE - Incremento per lvl gold', 45),
  ('SUSTAINABILITY', 'WIREDSCORE - Incremento per lvl platinum', 46),

  -- SUSTAINABILITY (ALTRI)
  ('SUSTAINABILITY', 'CRREM', 47), 
  ('SUSTAINABILITY', 'EU Taxonomy', 48), 
  ('SUSTAINABILITY', 'CAM', 49), 
  ('SUSTAINABILITY', 'LCA', 50), 
  ('SUSTAINABILITY', 'GRESB', 51), 
  ('SUSTAINABILITY', 'FITWEL', 52),

  -- ACUSTIC
  ('ACUSTIC', 'Studio di Fattibilità', 0), 
  ('ACUSTIC', 'Due Diligence', 1), 
  ('ACUSTIC', 'Progetto Preliminare', 2), 
  ('ACUSTIC', 'Progetto Definitivo per Permessi', 3), 
  ('ACUSTIC', 'Progetto Definitivo', 4), 
  ('ACUSTIC', 'Progetto Definitivo per Appalto', 5), 
  ('ACUSTIC', 'Progetto Esecutivo per Appalto', 6), 
  ('ACUSTIC', 'Direzione lavori Impianti', 7), 
  ('ACUSTIC', 'Assistenza ai Collaudi Acustici', 8), 
  ('ACUSTIC', 'Collaudi tecnico-funzionali Acustici', 9),

  -- VVF
  ('VVF', 'Studio di Fattibilità', 0), 
  ('VVF', 'Due Diligence', 1), 
  ('VVF', 'Progetto Preliminare', 2), 
  ('VVF', 'Progetto Definitivo per Permessi', 3), 
  ('VVF', 'Progetto Definitivo', 4), 
  ('VVF', 'Progetto Definitivo per Appalto', 5), 
  ('VVF', 'Progetto Esecutivo per Appalto', 6), 
  ('VVF', 'Direzione lavori Impianti', 7), 
  ('VVF', 'Assistenza ai Collaudi VVF', 8), 
  ('VVF', 'Collaudi tecnico-funzionali VVF', 9),

  -- STRUCTURE
  ('STRUCTURE', 'Studio di Fattibilità', 0), 
  ('STRUCTURE', 'Due Diligence', 1), 
  ('STRUCTURE', 'Progetto Preliminare', 2), 
  ('STRUCTURE', 'Progetto Definitivo per Permessi', 3), 
  ('STRUCTURE', 'Progetto Definitivo', 4), 
  ('STRUCTURE', 'Progetto Definitivo per Appalto', 5), 
  ('STRUCTURE', 'Progetto Esecutivo per Appalto', 6), 
  ('STRUCTURE', 'Direzione lavori Impianti', 7), 
  ('STRUCTURE', 'Assistenza ai Collaudi Strutture', 8), 
  ('STRUCTURE', 'Collaudi tecnico-funzionali Strutture', 9),

  -- GEOTHERMAL
  ('GEOTHERMAL', 'Studio di Fattibilità', 0), 
  ('GEOTHERMAL', 'Due Diligence', 1), 
  ('GEOTHERMAL', 'Progetto Preliminare', 2), 
  ('GEOTHERMAL', 'Progetto Definitivo per Permessi', 3), 
  ('GEOTHERMAL', 'Progetto Definitivo', 4), 
  ('GEOTHERMAL', 'Progetto Definitivo per Appalto', 5), 
  ('GEOTHERMAL', 'Progetto Esecutivo per Appalto', 6), 
  ('GEOTHERMAL', 'Direzione lavori Impianti', 7), 
  ('GEOTHERMAL', 'Assistenza ai Collaudi Geotermici', 8), 
  ('GEOTHERMAL', 'Collaudi tecnico-funzionali Geotermici', 9),

  -- HYDRAULIC INVARIANCE
  ('HYDRAULIC INVARIANCE', 'Invarianza Idraulica', 0),

  -- CONTINUOUS COMMISSIONING
  ('CONTINUOUS COMMISSIONING', 'Sviluppo Simulazione per allenamento algoritmo AI-Eco', 0), 
  ('CONTINUOUS COMMISSIONING', 'Sviluppo e rilascio dell''algoritmo AI-Eco', 1), 
  ('CONTINUOUS COMMISSIONING', 'Continuous Commissioning ed Ongoing monitoring activities', 2)
ON CONFLICT DO NOTHING;

-- ADD DEFAULT EMPLOYEES
INSERT INTO employees (name, position) VALUES 
  ('Admin', 'Administrator'),
  ('Standard User', 'Developer')
ON CONFLICT (name) DO NOTHING;

-- Migration: Create Offerte tables

CREATE TABLE IF NOT EXISTS offerte (
  id SERIAL PRIMARY KEY,
  anno INTEGER NOT NULL,                           -- Year (e.g., 2024, 2025)
  preventivo_number VARCHAR(50),                       -- PR number (e.g., 76 or PR-84)
  revision INTEGER DEFAULT 0,                      -- Revision number
  is_final_revision BOOLEAN DEFAULT FALSE,         -- "Rev. Final" marker
  tipo VARCHAR(20) DEFAULT 'P' CHECK (tipo IN ('P', 'G')),  -- P=Preventivo, G=Gara
  oggetto TEXT,                                    -- Project description/object
  committente VARCHAR(255),                        -- Intermediary/referring party
  cliente VARCHAR(255),                            -- End client name
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  superficie TEXT,                                 -- Building surface area
  destinazione_uso VARCHAR(255),                   -- Building use type
  specifiche TEXT,                                 -- Additional specs  
  valore_totale NUMERIC(12,2) DEFAULT 0,           -- Total offer value (k€)
  importo_opere NUMERIC(15,2) DEFAULT 0,           -- Value of works
  periodo_inizio DATE,                             -- Expected start
  periodo_fine DATE,                               -- Expected end
  criticita_ante TEXT,                             -- Pre-offer criticality
  criticita_risoluzione TEXT,                      -- Criticality resolution
  criticita_post TEXT,                             -- Post-offer criticality
  note TEXT,
  status VARCHAR(20) DEFAULT 'aperta' CHECK (status IN ('aperta', 'revisione', 'accettata', 'non_accettata', 'parziale')),
  -- Links to system entities (populated when accepted)
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  commessa_id INTEGER REFERENCES commesse(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offerte_anno ON offerte(anno);
CREATE INDEX IF NOT EXISTS idx_offerte_status ON offerte(status);
CREATE INDEX IF NOT EXISTS idx_offerte_client ON offerte(client_id);

CREATE TABLE IF NOT EXISTS offerta_lines (
  id SERIAL PRIMARY KEY,
  offerta_id INTEGER NOT NULL REFERENCES offerte(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,          -- 'PROG_CAD', 'PROG_BIM', 'CANTIERE', 'ENERGIA', 'SOSTENIBILITA', etc.
  attivita VARCHAR(255) NOT NULL,         -- Must match fatturato_lines.attivita values
  valore NUMERIC(12,2) DEFAULT 0,         -- Value in k€ (offer amount for this activity)
  included BOOLEAN DEFAULT TRUE,          -- Whether this activity is included in the offer
  note TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revised')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offerta_lines_offerta ON offerta_lines(offerta_id);

