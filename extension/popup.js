// popup.js
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
        const balanceElement = document.querySelector('span[data-testid="EVERYDAY CHECKING-balance"]') ||
                             document.querySelector('span.AccountInformation__amount-field___c2kaH');
        return balanceElement ? balanceElement.textContent.trim() : null;
      }
    });

    return results[0].result;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw new Error('Unable to read balance from the page');
  }
}

async function verifyProof() {
  try {
    // Load proof and public signals
    const [proof, publicSignals] = await Promise.all([
      fetch('proof.json').then(res => res.json()).catch(() => {
        throw new Error('Could not load proof file');
      }),
      fetch('public.json').then(res => res.json()).catch(() => {
        throw new Error('Could not load public signals file');
      })
    ]);
    
    // Send verification request to server
    try {
      const response = await fetch('http://localhost:3000/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ proof, publicSignals })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Server verification failed');
      }
      
      const { verified } = await response.json();
      return verified;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Could not connect to verification server. Please ensure the server is running.');
      }
      throw error;
    }
  } catch (error) {
    console.error('Verification error:', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const balanceElement = document.getElementById('balance');
  const verifyButton = document.getElementById('verifyButton');
  const statusElement = document.getElementById('verificationStatus');
  
  try {
    const balanceStr = await getBalance();
    if (balanceStr) {
      balanceElement.textContent = balanceStr;
      verifyButton.disabled = false;
    } else {
      throw new Error('Could not find balance on the page');
    }
  } catch (error) {
    balanceElement.textContent = error.message;
    balanceElement.classList.add('error');
  }
  
  verifyButton.addEventListener('click', async () => {
    statusElement.textContent = 'Verifying...';
    statusElement.className = '';
    verifyButton.disabled = true;
    
    try {
      const verified = await verifyProof();
      if (verified) {
        statusElement.textContent = 'Verified! Your balance is above $1,000';
        statusElement.classList.add('success');
      } else {
        statusElement.textContent = 'Verification failed - balance may be below $1,000';
        statusElement.classList.add('error');
      }
    } catch (error) {
      statusElement.textContent = error.message;
      statusElement.classList.add('error');
    } finally {
      verifyButton.disabled = false;
    }
  });
});