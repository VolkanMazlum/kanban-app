module.exports = (app, query, authenticate) => {
    app.get("/api/settings", async (req, res) => {
        try {
            const result = await query("SELECT key, value FROM settings");  
            const settings = {};
            result.rows.forEach(row => {
                settings[row.key] = row.value;
            });
            res.json(settings);
        } catch (err) {
            console.error("GET /settings Error:", err);
            res.status(500).json({ error: "Database error" });
        }
    });

    app.get("/api/settings/years", async (req, res) => {
        try {
            const result = await query(`
                WITH all_years AS (
                    -- Years from commesse numbers (flexible YY- or YY/ or YY )
                    SELECT DISTINCT 
                        (CASE 
                            WHEN comm_number ~ '^[0-9]{2}' THEN (2000 + LEFT(comm_number, 2)::int)
                            ELSE EXTRACT(YEAR FROM created_at)::int 
                        END) as yr 
                    FROM commesse
                    UNION
                    -- Years from all tasks (deadline)
                    SELECT DISTINCT EXTRACT(YEAR FROM deadline)::int as yr FROM tasks WHERE deadline IS NOT NULL
                    UNION
                    -- Years from all tasks (creation)
                    SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int as yr FROM tasks
                )
                SELECT DISTINCT yr FROM all_years WHERE yr IS NOT NULL AND yr > 2000 ORDER BY yr DESC
            `);
            let years = result.rows.map(r => r.yr);


            const currentYear = new Date().getFullYear();
            // Always ensure current year and next 2 years are available
            [currentYear, currentYear+1, currentYear+2].forEach(y => {
                if (!years.includes(y)) years.push(y);
            });
            years.sort((a,b) => b-a);
            res.json(years);
        } catch (err) {
            console.error("GET /settings/years Error:", err);
            res.status(500).json({ error: "Database error" });
        }
    });


    app.patch("/api/settings/:key", authenticate, async (req, res) => {
        const { key } = req.params;
        const { value } = req.body;
        try {
            // UPSERT: insert if not exists, update if exists
            await query(
                `INSERT INTO settings (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [key, value]
            );
            res.json({ message: "Setting updated successfully" });
        } catch (err) {
            console.error("PATCH /settings/:key Error:", err);
            res.status(500).json({ error: "Database error" });
        }
    });
};
