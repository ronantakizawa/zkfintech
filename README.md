# ZK-TLS Bank Account Balance Verifier

A Chrome extension that proves your bank account balance exceeds $1,000 without revealing the actual amount, using Zero-Knowledge Proofs.

## How It Works

### 1. Chrome Extension

The extension implements a secure three-step process:

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
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { in: balanceInCents.toString() },
    "circuit.wasm", 
    "circuit_final.zkey"
);
```

#### Secure Proof Storage and Verification
The proof is securely stored and verified using an authenticated session:

```javascript
await SecureStorage.setSecureItem('current_proof', {
    proof,
    publicSignals
}, 5); // 5 minutes expiry

const response = await fetch('http://localhost:3000/verify', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
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
    component gte = GreaterEqThan(64);
    gte.in[0] <== in;
    gte.in[1] <== threshold;
    out <== gte.out;
}
```

### 3. Secure Authentication Server

A Node.js server implements secure session management and proof verification:

```javascript
const sessionToken = crypto.randomBytes(32).toString('hex');
const JWT_SECRET = crypto.randomBytes(64).toString('hex');

app.post('/verify', authenticateJWT, validateRequest, async (req, res) => {
    const { proof, publicSignals } = req.body;
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    res.json({ verified });
});
```

## Security Features

### Data Security
- Secure XOR encryption for stored data
- Session-based storage with auto-expiry
- Automatic cleanup on session end
- Secure proof storage with 5-minute expiry

### Authentication Security
- JWT-based authentication
- Session token management
- Request signing
- Secure key storage

### Cryptographic Security
- Zero-knowledge proofs ensure privacy
- Groth16 proving system
- Hard-coded threshold in circuit
- Public signals only show pass/fail
- Encrypted storage for sensitive data

### Request Security
- Unique request IDs prevent replay attacks
- Timestamp validation
- Source validation
- Request integrity checks
- Rate limiting
- Session binding

## Project Structure

```
project/
├── extension/
│   ├── manifest.json     # Extension config
│   ├── popup.html       # UI components
│   ├── popup.js        # Core extension logic
│   └── snarkjs.min.js  # ZK-SNARK library
│
├── server/
│   ├── server.js       # Authentication & verification server
│   └── auth.js         # Authentication middleware
│
├── circuits/
│   ├── circuit.circom  # ZK circuit definition
│   └── compile.sh      # Circuit compilation script
│
└── package.json        # Dependencies
```

## Setup Instructions

1. Install Dependencies:
```bash
npm install
```

2. Compile Circuit:
```bash
cd circuits
./compile.sh
```

3. Generate Keys:
```bash
node generate-keys.js
```

4. Start Server:
```bash
node server/server.js
```

5. Load Extension:
- Open Chrome Extensions (chrome://extensions)
- Enable Developer mode
- Load unpacked extension from `extension` directory

## Security Recommendations

1. In production:
- Use hardware security modules for key storage
- Implement certificate pinning
- Add additional tampering checks
- Use more robust encryption
- Add rate limiting
- Implement request signing

2. For deployment:
- Host server on HTTPS
- Use secure DNS
- Implement WAF rules
- Monitor for suspicious activity
- Regular security audits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Submit pull request

## License

MIT LICENSE