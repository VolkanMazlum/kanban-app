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