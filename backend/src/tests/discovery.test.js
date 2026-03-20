const request = require("supertest");
const app = require("../index");
const { truncateTables, query, seedBaseData, ensureTestDbExists } = require("./helpers/test-db-setup");
const { getHrToken } = require("./helpers/auth-helper");

describe("Discovery Tests (TC-D01 - TC-D05)", () => {
  let token;

  beforeAll(async () => {
    await ensureTestDbExists();
    token = getHrToken();
    await truncateTables();
    await seedBaseData();
  });

  test("TC-D01: Labour trigger - Project appears due to hours in target year", async () => {
    // 1. Create project in 2025
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "2025 Project", status: "new" });
    
    if (taskRes.status !== 201) {
      console.error("TC-D01 Task Create Failed:", taskRes.status, taskRes.body);
    }
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.id;
    
    await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ task_id: taskId, comm_number: "25-003", name: "2025 Project" });

    // 2. Log 12 hours in March 2026
    await query(`
      INSERT INTO employee_work_hours (employee_id, task_id, date, hours)
      VALUES (1, $1, '2026-03-15', 12)
    `, [taskId]);

    // 3. Query 2026
    const res = await request(app)
      .get("/api/fatturato?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "25-003");
    expect(project).toBeDefined();
  });

  test("TC-D02: Revenue trigger - Project appears due to invoice index", async () => {
    // 1. Create project 24-010
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "24-010 Project", status: "new" });
    const taskId = taskRes.body.id;

    // We need to create the hierarchy first to have a line_id
    const hierarchyData = {
      task_id: taskId,
      comm_number: "24-010",
      clients: [{ client_id: 1, n_cliente: "01", lines: [{ attivita: "Line 1" }] }]
    };
    const fRes = await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send(hierarchyData);
    
    if (fRes.status !== 201) {
      console.error("TC-D02 Fatturato Create Failed:", fRes.status, fRes.body);
    }
    expect(fRes.status).toBe(201);

    const lineRes = await query(`
      SELECT fl.id FROM fatturato_lines fl 
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id 
      JOIN commesse c ON cc.commessa_id = c.id WHERE c.comm_number = '24-010'
    `);
    const lineId = lineRes.rows[0].id;

    // 2. Add invoice in 2026
    await query(`
      INSERT INTO fatturato_realized (fatturato_line_id, amount, registration_date)
      VALUES ($1, 8000, '2026-02-14')
    `, [lineId]);

    // 3. Query 2026
    const res = await request(app)
      .get("/api/fatturato?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "24-010");
    expect(project).toBeDefined();
    
    // Verify aggregation in by-task
    const byTaskRes = await request(app)
      .get("/api/fatturato/by-task?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);
    const pData = byTaskRes.body.find(p => p.comm_number === "24-010");
    expect(parseFloat(pData.total_fatturato)).toBe(8000);
  });

  test("TC-D03: Expense trigger - Project appears due to extra costs", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "25-007 Project", status: "new" });
    const taskId = taskRes.body.id;

    const commRes = await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ task_id: taskId, comm_number: "25-007" });

    // Add extra cost in 2026
    const commIdRes = await query("SELECT id FROM commesse WHERE comm_number = '25-007'");
    const commId = commIdRes.rows[0].id;
    await query(`
      INSERT INTO commessa_extra_costs (commessa_id, description, amount, date)
      VALUES ($1, 'Travel', 350, '2026-01-20')
    `, [commId]);

    const res = await request(app)
      .get("/api/fatturato?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "25-007");
    expect(project).toBeDefined();
  });

  test("TC-D04: No activity — exclusion", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "23-002 Old Project", status: "new" });
    const taskId = taskRes.body.id;

    await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ task_id: taskId, comm_number: "23-002" });

    // Query 2026
    const res = await request(app)
      .get("/api/fatturato?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "23-002");
    expect(project).toBeUndefined();
  });

  test("TC-D05: Creation-year trigger - New project visible by prefix", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "26-005 New", status: "new" });
    const taskId = taskRes.body.id;

    await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ task_id: taskId, comm_number: "26-005" });

    const res = await request(app)
      .get("/api/fatturato?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "26-005");
    expect(project).toBeDefined();
  });
});
