module.exports = (app, query) => {
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
    app.patch("/api/settings/:key", async (req, res) => {
        const { key } = req.params;
        const { value } = req.body;
        try {
            await query("UPDATE settings SET value = $1 WHERE key = $2", [value, key]);
            res.json({ message: "Setting updated successfully" });
        } catch (err) {
            console.error("PATCH /settings/:key Error:", err);
            res.status(500).json({ error: "Database error" });
        }
    });
};