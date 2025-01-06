const balanceElement = document.getElementById('balance');
const statusElement = document.getElementById('status');
const verifyButton = document.getElementById('verifyButton');

async function getBalance() {
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
                    const balanceElement = document.querySelector('span[data-testid="EVERYDAY CHECKING-balance"]');
                    if (!balanceElement) return null;
                    
                    // Additional validation for balance format
                    const balance = balanceElement.textContent.trim();
                    if (!/^\$\d{1,3}(,\d{3})*\.\d{2}$/.test(balance)) {
                        return null;
                    }
                    
                    return balance;
                } catch (e) {
                    return null;
                }
            }
        });

        if (!results || !results[0] || !results[0].result) {
            throw new Error('Could not read balance');
        }

        return results[0].result;
    } catch (error) {
        console.error('Error getting balance:', error);
        throw error;
    }
}

async function calculateProof(balanceInCents) {
    try {
        if (!window.snarkjs) {
            throw new Error('snarkjs not initialized');
        }

        const requestId = crypto.randomUUID();
        const timestamp = Date.now();

        console.log('Input balance in cents:', balanceInCents); // Log input
        
        // Generate the proof with private input
        const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
            {
                in: balanceInCents.toString()
            },
            "circuit.wasm",
            "circuit_final.zkey"
        );

        console.log('Generated proof:', proof); // Log proof
        console.log('Generated public signals:', publicSignals); // Log signals

        // Verify on server
        const response = await fetch('http://localhost:3000/verify', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Request-ID': requestId,
                'X-Timestamp': timestamp.toString(),
                'X-Balance-Source': 'EVERYDAY CHECKING-balance'
            },
            body: JSON.stringify({ 
                proof,
                publicSignals
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.log('Server error response:', errorData); // Log server error
            throw new Error(errorData.error || 'Verification request failed');
        }

        const { verified } = await response.json();
        return verified;

    } catch (error) {
        console.error("Error details:", error);
        throw error;
    }
}

verifyButton.addEventListener("click", async () => {
    try {
        statusElement.textContent = "Generating proof...";
        statusElement.style.color = 'black';
        verifyButton.disabled = true;

        // Get current balance
        const balanceStr = await getBalance();
        const balanceInCents = Math.floor(parseFloat(balanceStr.replace(/[$,]/g, '')) * 100);
        
        // Validate balance conversion
        if (isNaN(balanceInCents) || balanceInCents < 0) {
            throw new Error('Invalid balance format');
        }
        
        // Generate and verify proof
        const verified = await calculateProof(balanceInCents);

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

// Initial balance load
getBalance().then(balance => {
    balanceElement.textContent = balance || 'Not found';
    verifyButton.disabled = !balance;
}).catch(error => {
    balanceElement.textContent = 'Error loading balance';
    balanceElement.style.color = 'red';
    verifyButton.disabled = true;
});