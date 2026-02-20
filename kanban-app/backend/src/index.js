const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: "*" }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

pool.connect()
  .then(client => { console.log("✅ PostgreSQL connected"); client.release(); })
  .catch(err => console.error("❌ PostgreSQL error:", err.message));

const query = (text, params) => pool.query(text, params);

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ── Employees ──────────────────────────────────────────────────
app.get("/api/employees", async (req, res) => {
  try {
    const result = await query("SELECT * FROM employees ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});

app.post("/api/employees", async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  try {
    const result = await query("INSERT INTO employees (name) VALUES ($1) RETURNING *", [name.trim()]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});

app.delete("/api/employees/:id", async (req, res) => {
  try {
    // ON DELETE CASCADE sayesinde çalışanı silince ara tablodaki atamaları da otomatik silinecek
    await query("DELETE FROM employees WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});

// ── Tasks ──────────────────────────────────────────────────────
app.get("/api/tasks", async (req, res) => {
  try {
    const { assignee_id, status } = req.query;
    
    // YENİ MANTIK: tasks -> task_assignees -> employees şeklinde JOIN yapıyoruz
    let sql = `
      SELECT t.id, t.title, t.description, t.topic, t.deadline, t.status, t.position, t.created_at, t.updated_at,
             COALESCE(
               json_agg(json_build_object('id', e.id, 'name', e.name)) FILTER (WHERE e.id IS NOT NULL),
               '[]'
             ) AS assignees
      FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN employees e ON ta.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (assignee_id) { 
      params.push(assignee_id); 
      // Sadece belirli bir çalışanın görevlerini getirmek için EXISTS alt sorgusu
      sql += ` AND EXISTS (SELECT 1 FROM task_assignees sub_ta WHERE sub_ta.task_id = t.id AND sub_ta.employee_id = $${params.length})`; 
    }
    
    if (status) { 
      params.push(status); 
      sql += ` AND t.status = $${params.length}`; 
    }
    
    sql += " GROUP BY t.id ORDER BY t.status, t.position ASC, t.created_at ASC";
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { 
    console.error("GET /tasks Error:", err);
    res.status(500).json({ error: "Database error" }); 
  }
});

app.get("/api/tasks/:id", async (req, res) => {
  try {
    const sql = `
      SELECT t.*, 
             COALESCE(
               json_agg(json_build_object('id', e.id, 'name', e.name)) FILTER (WHERE e.id IS NOT NULL),
               '[]'
             ) AS assignees
      FROM tasks t 
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN employees e ON ta.employee_id = e.id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    const result = await query(sql, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});

app.post("/api/tasks", async (req, res) => {
  const { title, description, topic, assignee_ids, deadline, status, position } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
  
  try {
    // TRANSACTION BAŞLANGICI: Ya hepsi kaydedilir, ya da hiçbiri (Hata durumunda)
    await query("BEGIN");
    
    // 1. Görevi oluştur (artık assignee_ids veritabanı sütununda yok)
    const taskResult = await query(
      "INSERT INTO tasks (title, description, topic, deadline, status, position) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [title.trim(), description || "", topic || null, deadline || null, status || "new", position || 0]
    );
    const newTask = taskResult.rows[0];
    newTask.assignees = [];
    
    // 2. Kişileri ara tabloya (task_assignees) kaydet
    if (assignee_ids && assignee_ids.length > 0) {
      for (const empId of assignee_ids) {
        await query("INSERT INTO task_assignees (task_id, employee_id) VALUES ($1, $2)", [newTask.id, empId]);
      }
      // Frontend için atanan kişilerin bilgilerini çek
      const emps = await query("SELECT id, name FROM employees WHERE id = ANY($1)", [assignee_ids]);
      newTask.assignees = emps.rows;
    }
    
    await query("COMMIT");
    res.status(201).json(newTask);
  } catch (err) { 
    await query("ROLLBACK");
    console.error("POST /tasks Error:", err);
    res.status(500).json({ error: "Database error" }); 
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, topic, assignee_ids, deadline, status, position } = req.body;
  
  try {
    await query("BEGIN");
    
    const existing = await query("SELECT * FROM tasks WHERE id = $1", [id]);
    if (!existing.rows.length) {
      await query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }
    const t = existing.rows[0];
    
    // 1. Ana görevi güncelle
    const taskResult = await query(
      "UPDATE tasks SET title=$1, description=$2, topic=$3, deadline=$4, status=$5, position=$6 WHERE id=$7 RETURNING *",
      [title ?? t.title, description ?? t.description, topic ?? t.topic,
       deadline !== undefined ? deadline : t.deadline,
       status ?? t.status, position !== undefined ? position : t.position, id]
    );
    const updatedTask = taskResult.rows[0];
    updatedTask.assignees = [];

    // 2. Atamaları güncelle (Eğer frontend assignee_ids dizisi gönderdiyse)
    if (assignee_ids !== undefined) {
      // Eski atamaları sil
      await query("DELETE FROM task_assignees WHERE task_id = $1", [id]);
      
      // Yeni atamaları ekle
      if (assignee_ids.length > 0) {
        for (const empId of assignee_ids) {
          await query("INSERT INTO task_assignees (task_id, employee_id) VALUES ($1, $2)", [id, empId]);
        }
        const emps = await query("SELECT id, name FROM employees WHERE id = ANY($1)", [assignee_ids]);
        updatedTask.assignees = emps.rows;
      }
    } else {
       // Frontend assignee göndermediyse (örneğin sadece status değiştiyse), mevcut assigneeleri getir
       const existingEmps = await query(`
         SELECT e.id, e.name FROM employees e
         JOIN task_assignees ta ON e.id = ta.employee_id
         WHERE ta.task_id = $1
       `, [id]);
       updatedTask.assignees = existingEmps.rows;
    }

    await query("COMMIT");
    res.json(updatedTask);
  } catch (err) { 
    await query("ROLLBACK");
    console.error("PUT /tasks Error:", err);
    res.status(500).json({ error: "Database error" }); 
  }
});

app.patch("/api/tasks/:id/status", async (req, res) => {
  const { status } = req.body;
  const valid = ["new", "process", "blocked", "done"];
  if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });
  try {
    const result = await query("UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *", [status, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    // ON DELETE CASCADE sayesinde task silinince ara tablodaki kayıtlar otomatik silinir
    const result = await query("DELETE FROM tasks WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});

// ── KPIs ──────────────────────────────────────────────────────
app.get("/api/kpi", async (req, res) => {
  try {
    const statusRes = await query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status");
    const by_status = { new: 0, process: 0, blocked: 0, done: 0 };
    let totalTasks = 0;
    statusRes.rows.forEach(r => {
      by_status[r.status] = parseInt(r.count, 10);
      totalTasks += parseInt(r.count, 10);
    });

    const overdueRes = await query("SELECT COUNT(*) as count FROM tasks WHERE deadline < CURRENT_DATE AND status != 'done'");
    const overdue = parseInt(overdueRes.rows[0].count, 10);

    const summary = {
      total: totalTasks,
      completed_month: by_status.done,
      completed_week: by_status.done,
      overdue: overdue,
      avg_days_to_complete: 0
    };

    const topicRes = await query(`
      SELECT topic, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM tasks WHERE topic IS NOT NULL GROUP BY topic
    `);
    const by_topic = topicRes.rows.map(r => ({
      topic: r.topic, total: parseInt(r.total, 10), done: parseInt(r.done || 0, 10)
    }));

    // YENİ KPI SORGUSU: employees -> task_assignees -> tasks
    const empRes = await query(`
      SELECT e.id, e.name, 
             COUNT(t.id) as total_assigned,
             SUM(CASE WHEN t.status = 'new' THEN 1 ELSE 0 END) as new_count,
             SUM(CASE WHEN t.status = 'process' THEN 1 ELSE 0 END) as in_process,
             SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
      FROM employees e
      LEFT JOIN task_assignees ta ON e.id = ta.employee_id
      LEFT JOIN tasks t ON ta.task_id = t.id
      GROUP BY e.id, e.name
    `);
    const per_employee = empRes.rows.map(r => ({
      id: r.id, name: r.name,
      total_assigned: parseInt(r.total_assigned, 10),
      new_count: parseInt(r.new_count || 0, 10),
      in_process: parseInt(r.in_process || 0, 10),
      blocked: parseInt(r.blocked || 0, 10),
      done_count: parseInt(r.done_count || 0, 10)
    }));

    const trend = [{ month: "Recent", completed: by_status.done }];

    res.json({ summary, by_status, by_topic, per_employee, trend });
  } catch (err) { 
    console.error("KPI Error:", err);
    res.status(500).json({ error: "Database error while fetching KPIs" }); 
  }
});

app.listen(PORT, () => console.log(`🚀 TEKSER API running on http://localhost:${PORT}`));