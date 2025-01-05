const express = require('express');
const cors = require('cors');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Load verification key once at startup
console.log('Loading verification key...');
const vKey = JSON.parse(fs.readFileSync(path.join(__dirname, 'verification_key.json')));
console.log('Verification key loaded successfully');

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.post('/verify', async (req, res) => {
  console.log('\n=== New Verification Request ===');
  try {
    const { proof, publicSignals } = req.body;
    
    if (!proof || !publicSignals) {
      console.log('Error: Missing proof or public signals');
      return res.status(400).json({ 
        error: 'Missing required data',
        details: 'Both proof and public signals are required'
      });
    }

    console.log('Public Signals:', publicSignals);
    console.log('Proof received. Starting verification...');
    
    // Verify the proof
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    console.log('Verification result:', verified);
    
    res.json({ verified });
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