ZK-TLS Bank Account Balance Verifier

A Chrome extension that proves your bank account balance exceeds $1,000 without revealing the actual amount, using Zero-Knowledge Proofs.

## How It Works

### 1. Chrome Extension

The extension implements a three-step process:

#### Balance Extraction
The extension securely extracts your balance from your account's TLS response data:

```javascript
const account = data.applicationData.accountSummary.accounts.find(
    acc => acc.accountProfile?.accountName === "EVERYDAY CHECKING"
);
const balance = account?.balance?.[0]?.amount;
```

#### Zero-Knowledge Proof Generation
When the balance is loaded, the extension immediately generates a proof that your balance exceeds $1,000 without revealing the actual amount:

```javascript
const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
    { in: balanceInCents.toString() },
    "circuit.wasm", 
    "circuit_final.zkey"
);
```

#### Proof Verification
When you click "Verify", the extension sends the pre-generated proof to the verification server:

```javascript
const response = await fetch('http://localhost:3000/verify', {
    headers: { 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Timestamp': timestamp.toString(),
        'X-Balance-Source': 'EVERYDAY CHECKING-balance'
    },
    body: JSON.stringify({ proof, publicSignals })
});
```

### 2. Zero-Knowledge Circuit

The circuit implements the balance threshold check:

```circom
pragma circom 2.1.4;

template BalanceCheck() {
    signal input in;
    signal output out;
    
    var threshold = 100000; // $1000 in cents
    
    component gt = GreaterThan(64);
    gt.a <== in;
    gt.b <== threshold;
    
    out <== gt.out;
}
```

### 3. Verification Server

A Node.js server verifies the proofs:

```javascript
app.post('/verify', async (req, res) => {
    const { proof, publicSignals } = req.body;
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    res.json({ verified });
});
```

## Security Features

### Data Security
- Uses TLS response data
- Validates data structure and types
- Immediate proof generation on data load

### Cryptographic Security
- Zero-knowledge proofs ensure privacy
- Groth16 proving system
- Hard-coded threshold in circuit
- Public signals only show pass/fail

### Request Security
- Unique request IDs prevent replay attacks
- Timestamp validation
- Source validation
- Request integrity checks

## Project Structure

```
project/
├── extension/         # Built extension
│   ├── manifest.json  # Chrome Extension Congfig File
│   ├── popup.html     # Chrome Extension Page
│   ├── popup.js       # Chrome Extension JS files
│   └── snarkjs.min.js # SnarkJS Library file

├── server.js           # Verification server
└── package.json        # Dependencies
```

## Setup Instructions

1. Install Dependencies:
```bash
npm install
```

2. Compile Circuit:
Follow guidelines until step 24 on SnarkJS for how to build a Groth16 zk-SNARK: https://github.com/iden3/snarkjs?tab=readme-ov-file

4. Start Server:
```bash
node server.js
```

5. Load Extension:
- Open Chrome Extensions (chrome://extensions)
- Enable Developer mode
- Load unpacked extension from `extension` directory

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Submit pull request

## License

MIT LICENSE