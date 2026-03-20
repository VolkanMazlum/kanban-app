const request = require("supertest");
const app = require("../index");
const { truncateTables, query, seedBaseData, ensureTestDbExists } = require("./helpers/test-db-setup");
const { getHrToken } = require("./helpers/auth-helper");

describe("Hierarchy Tests (TC-H01 - TC-H03)", () => {
  let token;

  beforeAll(async () => {
    await ensureTestDbExists();
    token = getHrToken();
    await truncateTables();
    await seedBaseData();
  });

  afterAll(async () => {
    // await truncateTables();
  });

  test("TC-H01: Happy path - Create multi-tier hierarchy", async () => {
    // 1. Pre-requisites: Client and Task
    const clientRes = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ name: "Milan Office Owner", vat_number: "IT123456789" });
    
    const clientId = clientRes.body.id;

    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "Milan Office Renovation", status: "new" });
    
    const taskId = taskRes.body.id;

    // 2. Create Hierarchy
    const hierarchyData = {
      task_id: taskId,
      comm_number: "26-001",
      name: "Milan Office Renovation",
      clients: [
        {
          client_id: clientId,
          n_cliente: "01",
          lines: [
            {
              attivita: "Preliminary Design",
              valore_ordine: 50000,
              ordini: [{ label: "SAL 1", percentage: 100 }]
            }
          ]
        }
      ]
    };

    const res = await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send(hierarchyData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // 3. Verify DB
    const commRes = await query("SELECT * FROM commesse WHERE comm_number = '26-001'");
    expect(commRes.rows.length).toBe(1);
    expect(commRes.rows[0].task_id).toBe(taskId);

    const ccRes = await query("SELECT * FROM commessa_clients WHERE commessa_id = $1", [commRes.rows[0].id]);
    expect(ccRes.rows.length).toBe(1);

    const flRes = await query("SELECT * FROM fatturato_lines WHERE commessa_client_id = $1", [ccRes.rows[0].id]);
    expect(flRes.rows.length).toBe(1);
    expect(flRes.rows[0].attivita).toBe("Preliminary Design");
    expect(parseFloat(flRes.rows[0].valore_ordine)).toBe(50000);
  });

  test("TC-H02: Constraint check - Prevent second commessa for same task", async () => {
    // Task 2 is already used in TC-H01 (wait, I should use a new one)
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "Second Task", status: "new" });
    const taskId = taskRes.body.id;

    // Create first commessa
    const firstRes = await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ task_id: taskId, comm_number: "26-002", name: "First" });
    
    expect(firstRes.status).toBe(201);

    // Attempt second commessa for same task
    const res = await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ task_id: taskId, comm_number: "26-003", name: "Second" });

    // Note: The backend currently DOES NOT have this constraint in the DB or code (based on my review).
    // I should check if I need to implement it to pass the test, or if the test should fail.
    // TC says: "The system should prevent this...". 
    expect(res.status).toBe(400); 
    expect(res.body.error).toMatch(/already linked/i);
  });

  test("TC-H03: Multiple activity lines - Fatturato aggregation", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send({ title: "Multi Line Project", status: "new" });
    const taskId = taskRes.body.id;

    const hierarchyData = {
      task_id: taskId,
      comm_number: "26-004",
      name: "Multi Line Project",
      clients: [
        {
          client_id: 1, // Assume client 1 exists or use the one from TC-H01
          n_cliente: "02",
          lines: [
            { attivita: "Preliminary Design", valore_ordine: 20000 },
            { attivita: "BIM Modeling", valore_ordine: 35000 },
            { attivita: "Final Drawings", valore_ordine: 15000 }
          ]
        }
      ]
    };

    await request(app)
      .post("/api/fatturato")
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET)
      .send(hierarchyData);

    // Query total valore_ordine for this client
    const res = await request(app)
      .get(`/api/fatturato/by-task?year=2026`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-internal-auth", process.env.INTERNAL_SECRET);

    const projectData = res.body.find(p => p.comm_number === "26-004");
    expect(parseFloat(projectData.total_valore_ordine)).toBe(70000); // 20k + 35k + 15k
  });
});
