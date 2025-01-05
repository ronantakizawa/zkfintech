const express = require("express");
const snarkjs = require("snarkjs");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/verify", async (req, res) => {
    try {
        const { proof, publicSignals } = req.body;
        const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        res.json({ verified });
    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ error: "Verification failed" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});