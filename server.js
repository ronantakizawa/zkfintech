const express = require('express');
const snarkjs = require('snarkjs');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

// Store used request IDs (use Redis/DB in production)
const usedRequestIds = new Set();

// In production, use secure key management
const JWT_SECRET = crypto.randomBytes(64).toString('hex');

// Session storage (use Redis/DB in production)
const activeSessions = new Map();

// Load verification key once at startup
console.log('Loading verification key...');
const vKey = JSON.parse(fs.readFileSync("verification_key.json"));
console.log('Verification key loaded successfully');

// Initialize session endpoint
app.post('/init-session', (req, res) => {
    try {
        // Generate session token
        const sessionToken = uuidv4();
        
        // Create session with temporary secret
        const tempSecret = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes
        
        activeSessions.set(sessionToken, {
            secret: tempSecret,
            expiresAt
        });

        // Set cookie with session token
        res.cookie('session_token', sessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 30 * 60 * 1000 // 30 minutes
        });

        res.json({ sessionToken });

    } catch (error) {
        console.error('Session initialization error:', error);
        res.status(500).json({ error: 'Failed to initialize session' });
    }
});

// OAuth2 token endpoint
app.post('/oauth/token', (req, res) => {
    const { session_token } = req.body;

    // Validate session
    const sessionData = activeSessions.get(session_token);
    if (!sessionData || Date.now() > sessionData.expiresAt) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Generate JWT token
    const token = jwt.sign(
        { session: session_token },
        JWT_SECRET,
        { expiresIn: '30m' }
    );

    res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 1800
    });
});

// JWT Authentication middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Validate session still exists
        const sessionData = activeSessions.get(decoded.session);
        if (!sessionData || Date.now() > sessionData.expiresAt) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        req.session = decoded.session;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Request validation middleware
const validateRequest = (req, res, next) => {
    const timestamp = parseInt(req.headers['x-timestamp']);
    const requestId = req.headers['x-request-id'];
    const balanceSource = req.headers['x-balance-source'];

    console.log(`Processing request - RequestID: ${requestId}, Timestamp: ${timestamp}, Source: ${balanceSource}`);

    if (balanceSource !== 'EVERYDAY CHECKING-balance') {
        console.log('Invalid balance source');
        return res.status(400).json({ error: 'Invalid balance source' });
    }

    if (Date.now() - timestamp > 5 * 60 * 1000) {
        console.log('Request expired');
        return res.status(400).json({ error: 'Request expired' });
    }

    if (usedRequestIds.has(requestId)) {
        console.log('Request ID reuse detected');
        return res.status(400).json({ error: 'Request already processed' });
    }
    usedRequestIds.add(requestId);

    next();
};

// Protected verify endpoint
app.post('/verify', authenticateJWT, validateRequest, async (req, res) => {
    console.log('\n=== New Verification Request ===');
    try {
        const { proof, publicSignals } = req.body;
        
        if (!proof || !publicSignals) {
            console.log('Missing proof or public signals');
            return res.status(400).json({ error: 'Missing required data' });
        }

        console.log('Verifying proof...');
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        console.log('Valid Proof:', verified);

        if (!verified) {
            console.log('Proof verification failed');
            return res.status(400).json({ error: 'Proof verification failed' });
        }

        const result = publicSignals[0];
        console.log('Result value:', result);
        
        if (result !== "0" && result !== "1") {
            console.log('Invalid result value');
            return res.status(400).json({ error: 'Invalid result value' });
        }

        if (result === "1") {
            console.log('Invalid balance');
            return res.status(400).json({ error: 'Invalid balance' });
        }

        res.json({ verified: true, message: 'Valid balance' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ 
            error: 'Verification failed',
            details: error.message
        });
    }
});

// Cleanup expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of activeSessions.entries()) {
        if (now > data.expiresAt) {
            activeSessions.delete(token);
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n=== ZK Verification Server ===`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Ready to verify proofs\n`);
});