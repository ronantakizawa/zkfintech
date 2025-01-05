# ZK Balance Verification System

This project consists of a Chrome extension and Node.js server that work together to verify a Wells Fargo account balance exceeds $1,000 using Zero-Knowledge proofs. The system allows users to prove their balance exceeds a threshold without revealing the actual balance.

## Project Structure

```
project/
├── zk-server/             # Backend verification server
│   ├── server.js          # Server implementation
│   ├── package.json       # Server dependencies
│   └── verification_key.json  # ZK verification key
│
└── zk-extension/          # Chrome extension
    ├── manifest.json      # Extension configuration
    ├── popup.html        # Extension interface
    ├── popup.js          # Extension logic
    ├── proof.json        # Generated ZK proof
    └── public.json       # Public signals
```

## Prerequisites

- Node.js (v14 or higher)
- npm
- Google Chrome browser
- circom (for generating new proofs)
- snarkjs

## Setup Instructions

### 1. Server Setup

```bash
# Navigate to server directory
cd zk-server

# Install dependencies
npm install

# Copy the verification key
cp path/to/verification_key.json .

# Start the server
npm start
```

The server will run on http://localhost:3000.

### 2. Chrome Extension Setup

1. Navigate to `chrome://extensions/` in Chrome
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `zk-extension` directory

### 3. Generate New Proofs (Optional)

If you need to generate new proofs:

```bash
# Compile the circuit
circom circuit.circom --r1cs --wasm --sym

# Generate a proof
snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json
```

## Usage

1. Navigate to your Wells Fargo account summary page
2. Click the extension icon in Chrome
3. Click "Verify Balance > $1,000"
4. The extension will display the verification result

## System Components

### Server (zk-server)

The Node.js server handles proof verification using snarkjs. Key features:
- Express server with CORS enabled
- Loads verification key at startup
- Single endpoint for proof verification
- Detailed logging

### Chrome Extension (zk-extension)

The extension interacts with Wells Fargo's page and the verification server. Features:
- Reads balance from the page
- Sends proof to server for verification
- User-friendly error messages
- Secure communication with server

## Security Features

- Zero-Knowledge proofs ensure privacy
- Server-side verification prevents tampering
- Content Security Policy in extension
- Error handling for all edge cases

## API Endpoints

### POST /verify

Verifies a zero-knowledge proof.

Request body:
```json
{
  "proof": {
    // Groth16 proof data
  },
  "publicSignals": [
    // Public inputs
  ]
}
```

Response:
```json
{
  "verified": true/false
}
```

## Error Handling

The system includes comprehensive error handling for:
- Server connection issues
- Invalid proofs
- Missing files
- Network errors
- Invalid page states

## Development

To modify the system:

1. Server changes:
   - Modify `server.js`
   - Update error handling as needed
   - Add new endpoints if required

2. Extension changes:
   - Update `popup.js` for new features
   - Modify `manifest.json` for permissions
   - Update UI in `popup.html`

## Troubleshooting

1. Server Issues:
   - Ensure server is running on port 3000
   - Check verification_key.json exists
   - Verify network connectivity

2. Extension Issues:
   - Ensure you're on the correct Wells Fargo page
   - Check browser console for errors
   - Verify proof files exist

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT LICENSE