const balanceElement = document.getElementById('balance');
const statusElement = document.getElementById('status');
const verifyButton = document.getElementById('verifyButton');

async function getBalance() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    const results = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: function() {
            const balanceElement = document.querySelector('span[data-testid="EVERYDAY CHECKING-balance"]');
            return balanceElement ? balanceElement.textContent.trim() : null;
        }
    });

    return results[0].result;
}

async function calculateProof(balanceInCents) {
  try {
      if (!window.snarkjs) {
          throw new Error('snarkjs not initialized');
      }

      // Generate the proof
      const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
          {
              in: [balanceInCents.toString(), "100000"] // Changed to match circuit input format
          },
          "circuit.wasm",
          "circuit_final.zkey"
      );

      // Verify on server
      const response = await fetch('http://localhost:3000/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proof, publicSignals })
      });

      const { verified } = await response.json();
      return verified;

  } catch (error) {
      console.error("Error:", error);
      throw error;
  }
}

verifyButton.addEventListener("click", async () => {
    try {
        statusElement.textContent = "Generating proof...";
        verifyButton.disabled = true;

        // Get current balance
        const balanceStr = await getBalance();
        const balanceInCents = Math.floor(parseFloat(balanceStr.replace(/[$,]/g, '')) * 100);
        
        // Generate and verify proof
        const verified = await calculateProof(balanceInCents);

        statusElement.textContent = verified ? 
            "Verified! Balance is above $1,000" : 
            "Verification failed";

    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
    } finally {
        verifyButton.disabled = false;
    }
});

// Initial balance load
getBalance().then(balance => {
    balanceElement.textContent = balance || 'Not found';
    verifyButton.disabled = !balance;
});