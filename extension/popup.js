(async () => {
    const balanceElement = document.getElementById('balance');
    const statusElement = document.getElementById('status');
    const verifyButton = document.getElementById('verifyButton');
    const snarkjs = window.snarkjs;
    delete window.snarkjs;

    const SecureStorage = {
        async encrypt(data) {
            const text = JSON.stringify(data);
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(text);
            
            const { encryptionKey } = await chrome.storage.local.get('encryptionKey');
            const key = encryptionKey ? 
                new Uint8Array(encryptionKey) : 
                crypto.getRandomValues(new Uint8Array(32));
                
            if (!encryptionKey) {
                await chrome.storage.local.set({ 
                    encryptionKey: Array.from(key) 
                });
            }

            const encrypted = new Uint8Array(encodedData.length);
            for (let i = 0; i < encodedData.length; i++) {
                encrypted[i] = encodedData[i] ^ key[i % key.length];
            }
            
            return Array.from(encrypted);
        },

        async decrypt(encryptedData) {
            const { encryptionKey } = await chrome.storage.local.get('encryptionKey');
            if (!encryptionKey) return null;

            const key = new Uint8Array(encryptionKey);
            const encrypted = new Uint8Array(encryptedData);
            
            const decrypted = new Uint8Array(encrypted.length);
            for (let i = 0; i < encrypted.length; i++) {
                decrypted[i] = encrypted[i] ^ key[i % key.length];
            }

            const decoder = new TextDecoder();
            const text = decoder.decode(decrypted);
            return JSON.parse(text);
        },

        async setSecureItem(key, value, expiryMinutes = 30) {
            const encrypted = await this.encrypt(value);
            await chrome.storage.session.set({
                [key]: encrypted,
                [`${key}_expiry`]: Date.now() + (expiryMinutes * 60 * 1000)
            });
        },

        async getSecureItem(key) {
            const data = await chrome.storage.session.get([key, `${key}_expiry`]);
            
            if (!data[key] || !data[`${key}_expiry`] || 
                Date.now() > data[`${key}_expiry`]) {
                await this.removeSecureItem(key);
                return null;
            }

            return await this.decrypt(data[key]);
        },

        async removeSecureItem(key) {
            await chrome.storage.session.remove([key, `${key}_expiry`]);
        }
    };

    function generateUUID() {
        return crypto.randomUUID();
    }

    async function initializeSession() {
        try {
            const response = await fetch('http://localhost:3000/init-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to initialize session');
            }

            const data = await response.json();
            await SecureStorage.setSecureItem('session_token', data.sessionToken);
            return data.sessionToken;
        } catch (error) {
            console.error('Session initialization error:', error);
            throw error;
        }
    }

    async function authenticateWithServer() {
        try {
            // Check existing token
            const existingToken = await SecureStorage.getSecureItem('auth_token');
            if (existingToken) {
                return true;
            }

            // Get or initialize session
            let sessionToken = await SecureStorage.getSecureItem('session_token');
            if (!sessionToken) {
                sessionToken = await initializeSession();
            }

            const response = await fetch('http://localhost:3000/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_token: sessionToken
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await SecureStorage.removeSecureItem('session_token');
                }
                throw new Error('Authentication failed');
            }

            const data = await response.json();
            await SecureStorage.setSecureItem('auth_token', data.access_token, data.expires_in / 60);
            return true;

        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    async function getBalanceAndGenerateProof() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            const url = new URL(currentTab.url);
            const isCorrectPage = url.protocol === 'https:' && 
                                url.hostname === 'connect.secure.wellsfargo.com' &&
                                url.hash.includes('/accounts/home/accountsummary');
            
            if (!isCorrectPage) {
                throw new Error('Please navigate to your Wells Fargo account summary page');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                function: function() {
                    try {
                        const scripts = Array.from(document.getElementsByTagName('script'));
                        for (const script of scripts) {
                            const content = script.textContent;
                            if (content && content.includes('"applicationData"')) {
                                try {
                                    const match = content.match(/\{[\s\S]*\}/);
                                    if (match) {
                                        const data = JSON.parse(match[0]);
                                        if (data.applicationData?.accountSummary?.accounts) {
                                            const account = data.applicationData.accountSummary.accounts.find(
                                                acc => acc.accountProfile?.accountName === "EVERYDAY CHECKING"
                                            );
                                            if (account?.balance?.[0]?.amount) {
                                                return account.balance[0].amount;
                                            }
                                        }
                                    }
                                } catch (parseError) {
                                    console.error("Parse error:", parseError);
                                }
                            }
                        }
                        return null;
                    } catch (e) {
                        console.error("Error in content script:", e);
                        return null;
                    }
                }
            });

            if (!results || !results[0] || results[0].result === null) {
                throw new Error('Could not read balance from response data');
            }

            const result = results[0].result;
            const formattedBalance = typeof result === 'number' ? 
                `$${result.toFixed(2)}` : result;

            if (!snarkjs) {
                throw new Error('snarkjs not initialized');
            }

            const balanceInCents = Math.floor(parseFloat(formattedBalance.replace(/[$,]/g, '')) * 100);
            if (isNaN(balanceInCents) || balanceInCents < 0) {
                throw new Error('Invalid balance format');
            }

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                {
                    in: balanceInCents.toString()
                },
                "circuit.wasm",
                "circuit_final.zkey"
            );

            // Store proof and signals securely
            await SecureStorage.setSecureItem('current_proof', {
                proof,
                publicSignals
            }, 5); // 5 minutes expiry

            return formattedBalance;

        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    async function verifyStoredProof() {
        try {
            const proofData = await SecureStorage.getSecureItem('current_proof');
            if (!proofData) {
                throw new Error('No proof available');
            }

            const authToken = await SecureStorage.getSecureItem('auth_token');
            if (!authToken) {
                throw new Error('Authentication failed. Please try again.');
            }

            const requestId = generateUUID();
            const timestamp = Date.now();

            const response = await fetch('http://localhost:3000/verify', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-Request-ID': requestId,
                    'X-Timestamp': timestamp.toString(),
                    'X-Balance-Source': 'EVERYDAY CHECKING-balance'
                },
                body: JSON.stringify({ 
                    proof: proofData.proof,
                    publicSignals: proofData.publicSignals
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    await SecureStorage.removeSecureItem('auth_token');
                    await SecureStorage.removeSecureItem('session_token');
                    throw new Error('Verification failed. Please try again.');
                }
                throw new Error(errorData.error || 'Verification failed');
            }

            const { verified } = await response.json();
            return verified;

        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    verifyButton.addEventListener("click", async () => {
        try {
            statusElement.textContent = "Verifying proof...";
            statusElement.style.color = 'black';
            verifyButton.disabled = true;

            const verified = await verifyStoredProof();

            if (verified) {
                statusElement.textContent = "Verified! Balance is above $1,000";
                statusElement.style.color = 'green';
            } else {
                statusElement.textContent = "Verification failed";
                statusElement.style.color = 'red';
            }
        } catch (error) {
            statusElement.textContent = error.message;
            statusElement.style.color = 'red';
        } finally {
            const authToken = await SecureStorage.getSecureItem('auth_token');
            verifyButton.disabled = !authToken;
        }
    });

    // Initialize with authentication and balance fetching
    try {
        // First authenticate silently
        const isAuthenticated = await authenticateWithServer();
        
        if (!isAuthenticated) {
            throw new Error('Could not load balance');
        }

        // Then get balance and generate proof
        const balance = await getBalanceAndGenerateProof();
        balanceElement.textContent = balance || 'Not found';
        
        // Enable verify button if we have auth token
        const authToken = await SecureStorage.getSecureItem('auth_token');
        verifyButton.disabled = !authToken;
    } catch (error) {
        balanceElement.textContent = 'Error loading balance';
        balanceElement.style.color = 'red';
        verifyButton.disabled = true;
    }

    // Cleanup on unload
    window.addEventListener('unload', () => {
        chrome.storage.session.clear();
    });
})();