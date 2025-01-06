# ZK Balance Verification System

This project demonstrates how to securely verify a Wells Fargo account balance exceeds $1,000 using Zero-Knowledge proofs, implemented through a Chrome extension and verification server.

## Project Structure

```
project/
├── extension/            # Chrome extension
│   ├── dist/            # Built extension with obfuscated code
│   ├── manifest.json    # Extension configuration
│   ├── popup.html      # Extension UI
│   ├── popup.js        # Extension logic (pre-obfuscation)
│   ├── init.js         # Snarkjs initialization
│   ├── snarkjs.min.js  # Snarkjs library
│   ├── circuit.wasm    # Compiled circuit
│   ├── circuit_final.zkey # Circuit proving key
│   ├── obfuscator-config.json # Obfuscation settings
│   └── obfuscate.js    # Obfuscation script
│
├── server.js           # Verification server
└── package.json        # Server dependencies
```

## Prerequisites

- Node.js (v14 or higher)
- npm
- Google Chrome browser
- circom (for circuit compilation)
- snarkjs

## Setup Instructions

### Server Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node server.js
```

### Extension Setup

1. Install dependencies:
```bash
cd extension
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load the built extension in Chrome:
- Go to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `extension/dist` directory

## Security Features

1. Code Protection:
- JavaScript obfuscation
- Self-defending code
- Debug protection
- Console output disabled
- String encryption

2. Proof Generation:
- Real-time proof generation
- Tamper-resistant balance reading
- DOM manipulation detection
- Source validation

3. Network Security:
- Request signing
- Timestamp validation
- Request ID tracking

4. Server Security:
- Rate limiting
- Request verification
- Error logging
- CORS protection

## Development

1. Modify source code in extension directory
2. Build obfuscated version:
```bash
cd extension
npm run build
```

3. Clean build:
```bash
cd extension
npm run clean
```

## Obfuscation Configuration

The project uses `javascript-obfuscator` with the following protections:
- Control flow flattening
- Dead code injection
- Debug protection
- String encryption
- Code self-defense
- Identifier obfuscation

Configure obfuscation settings in `extension/obfuscator-config.json`.

## Production Deployment

1. Server:
- Configure environment variables
- Enable security headers
- Set up monitoring

2. Extension:
- Build with production configuration
- Test obfuscated code
- Package for Chrome Web Store

## Security Considerations

1. Code Protection:
- All source code is obfuscated
- Debug protection enabled
- Self-defending code
- String encryption

2. Balance Validation:
- DOM structure verification
- Mutation detection
- Source validation
- Format checking

3. Server Security:
- Request validation
- Timestamp checking
- Source verification
- Rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes in source directories
4. Build and test
5. Submit pull request

## License

MIT LICENSE

## Security Notice

This is a demonstration project that includes various security features including code obfuscation. For production use:
1. Implement additional security measures
2. Conduct security audits
3. Set up proper monitoring
4. Use secure key management
5. Enable detailed logging
6. Regularly update obfuscation patterns