const balanceElement = document.getElementById('balance');
const statusElement = document.getElementById('status');
const verifyButton = document.getElementById('verifyButton');
window.snarkjs = snarkjs;

// Store proof and signals globally
let storedProof = null;
let storedPublicSignals = null;

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
                    return null; // If no balance is found in the scripts, return null
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

        // Generate proof immediately
        if (!window.snarkjs) {
            throw new Error('snarkjs not initialized');
        }

        const balanceInCents = Math.floor(parseFloat(formattedBalance.replace(/[$,]/g, '')) * 100);
        if (isNaN(balanceInCents) || balanceInCents < 0) {
            throw new Error('Invalid balance format');
        }

        const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
            {
                in: balanceInCents.toString()
            },
            "circuit.wasm",
            "circuit_final.zkey"
        );

        // Store proof and signals
        storedProof = proof;
        storedPublicSignals = publicSignals;

        return formattedBalance;

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

async function verifyStoredProof() {
    try {
        if (!storedProof || !storedPublicSignals) {
            throw new Error('No proof available');
        }

        const requestId = crypto.randomUUID();
        const timestamp = Date.now();

        const response = await fetch('http://localhost:3000/verify', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Request-ID': requestId,
                'X-Timestamp': timestamp.toString(),
                'X-Balance-Source': 'EVERYDAY CHECKING-balance'
            },
            body: JSON.stringify({ 
                proof: storedProof,
                publicSignals: storedPublicSignals
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Verification request failed');
        }

        const { verified } = await response.json();
        return verified;

    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

// Button only verifies the stored proof
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
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.style.color = 'red';
    } finally {
        verifyButton.disabled = false;
    }
});

// Generate proof immediately on load
getBalanceAndGenerateProof().then(balance => {
    balanceElement.textContent = balance || 'Not found';
    verifyButton.disabled = !storedProof;
}).catch(error => {
    balanceElement.textContent = 'Error loading balance';
    balanceElement.style.color = 'red';
    verifyButton.disabled = true;
});