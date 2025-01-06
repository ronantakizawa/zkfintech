const express = require('express');
const snarkjs = require('snarkjs');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

// Store used request IDs (use Redis/DB in production)
const usedRequestIds = new Set();

// Load verification key once at startup
console.log('Loading verification key...');
const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
console.log('Verification key loaded successfully');

// Middleware to validate request
app.use('/verify', (req, res, next) => {
    const timestamp = parseInt(req.headers['x-timestamp']);
    const requestId = req.headers['x-request-id'];
    const balanceSource = req.headers['x-balance-source'];

    console.log(`Processing request - RequestID: ${requestId}, Timestamp: ${timestamp}, Source: ${balanceSource}`);

    // Verify balance source
    if (balanceSource !== 'EVERYDAY CHECKING-balance') {
        console.log('Invalid balance source');
        return res.status(400).json({ error: 'Invalid balance source' });
    }

    // Check timestamp (5 minute window)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
        console.log('Request expired');
        return res.status(400).json({ error: 'Request expired' });
    }

    // Check for request ID reuse
    if (usedRequestIds.has(requestId)) {
        console.log('Request ID reuse detected');
        return res.status(400).json({ error: 'Request already processed' });
    }
    usedRequestIds.add(requestId);

    next();
});

app.post('/verify', async (req, res) => {
    console.log('\n=== New Verification Request ===');
    try {
        const { proof, publicSignals } = req.body;
        
        if (!proof || !publicSignals) {
            console.log('Missing proof or public signals');
            return res.status(400).json({ 
                error: 'Missing required data'
            });
        }

        // Log received data
        console.log('Received public signals:', publicSignals);
        console.log('Received proof:', proof);

        // Verify the proof
        console.log('Verifying proof...');
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        console.log('Valid Proof:', verified);

        // Check verification result
        if (!verified) {
            console.log('Proof verification failed');
            return res.status(400).json({
                error: 'Proof verification failed'
            });
        }

        // Additional validation for result
        const result = publicSignals[0];
        console.log('Result value:', result);
        
        if (result !== "0" && result !== "1") {
            console.log('Invalid result value');
            return res.status(400).json({
                error: 'Invalid result value'
            });
        }

        // Logic for valid/invalid balance
        if (result === "1") {
            console.log('Invalid balance');
            return res.status(400).json({
                error: 'Invalid balance'
            });
        }

        // If result is "0", the balance is valid
        res.json({ verified: true, message: 'Valid balance' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ 
            error: 'Verification failed',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n=== ZK Verification Server ===`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Ready to verify proofs\n`);
});