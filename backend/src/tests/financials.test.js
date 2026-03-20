const request = require("supertest");
const app = require("../index");
const { truncateTables, query, seedBaseData, ensureTestDbExists } = require("./helpers/test-db-setup");
const { getHrToken } = require("./helpers/auth-helper");

describe("Financial Metrics Tests (TC-F01 - TC-F05)", () => {
  let token;

  beforeAll(async () => {
    await ensureTestDbExists();
    token = getHrToken();
    await truncateTables();
    await seedBaseData();
  });

  test("TC-F01: Realized revenue - Year isolation", async () => {
    // 1. Project with lines
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "F01 Project", status: "new" });
    const taskId = taskRes.body.id;
    
    await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ 
        task_id: taskId, 
        comm_number: "26-F01",
        clients: [{ client_id: 1, n_cliente: "01", lines: [{ attivita: "Line 1" }] }]
      });

    const lineRes = await query(`
      SELECT fl.id FROM fatturato_lines fl 
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id 
      JOIN commesse c ON cc.commessa_id = c.id WHERE c.comm_number = '26-F01'
    `);
    const lineId = lineRes.rows[0].id;

    // 2. Add invoice in 2025 and 2026
    await query("INSERT INTO fatturato_realized (fatturato_line_id, amount, registration_date) VALUES ($1, 5000, '2025-12-31')", [lineId]);
    await query("INSERT INTO fatturato_realized (fatturato_line_id, amount, registration_date) VALUES ($1, 7000, '2026-01-01')", [lineId]);

    // 3. Query 2026
    const res = await request(app)
      .get("/api/fatturato/by-task?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "26-F01");
    expect(parseFloat(project.total_fatturato)).toBe(7000);
  });

  test("TC-F02: Labour cost - Formula (H * S / 2000)", async () => {
    // 1. Employee with salary 60k
    const empRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ name: "John Cost", category: "internal", position: "Dev", is_active: true });
    const empId = empRes.body.id;

    await request(app)
      .post(`/api/costs/${empId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ annual_gross: 60000, valid_from: "2026-01-01" });

    // 2. Task and 160 hours in 2026
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "Labor Task", status: "new" });
    const taskId = taskRes.body.id;

    await query("INSERT INTO employee_work_hours (employee_id, task_id, date, hours) VALUES ($1, $2, '2026-05-10', 160)", [empId, taskId]);

    // 3. Verify in task-finances
    const res = await request(app)
      .get("/api/task-finances?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const taskFin = res.body.tasks.find(t => t.id === taskId);
    // Cost = 160 * (60000 / 2000) = 160 * 30 = 4800
    expect(parseFloat(taskFin.internal_cost)).toBe(4800);
  });

  test("TC-F05: Scheduled revenue - Percentage calculation", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "Scheduled Task", status: "new" });
    const taskId = taskRes.body.id;

    const hierarchyData = {
      task_id: taskId,
      comm_number: "26-F05",
      clients: [
        {
          client_id: 1,
          n_cliente: "01",
          lines: [
            {
              attivita: "Phase 1",
              valore_ordine: 100000,
              ordini: [
                { label: "Downpayment", percentage: 20, expected_date: "2026-03-01" },
                { label: "Delivery", percentage: 30, expected_date: "2026-06-01" }
              ]
            }
          ]
        }
      ]
    };

    await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send(hierarchyData);

    const res = await request(app)
      .get("/api/fatturato/by-task?year=2026")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const project = res.body.find(p => p.comm_number === "26-F05");
    // total_scheduled should be (20% + 30%) of 100,000 = 50,000
    expect(parseFloat(project.total_scheduled_amount)).toBe(50000);
  });
});
