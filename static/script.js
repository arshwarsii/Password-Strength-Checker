// static/script.js
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('brute-force-form');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const progressContainer = document.getElementById('progress-container');
    const resultContainer = document.getElementById('result-container');
    const failedContainer = document.getElementById('failed-container');
    const progressBar = document.getElementById('progress-bar');
    const statusElement = document.getElementById('status');
    const attemptsElement = document.getElementById('attempts');
    const elapsedElement = document.getElementById('elapsed');
    const currentAttemptElement = document.getElementById('current-attempt');
    const crackedPasswordElement = document.getElementById('cracked-password');
    const totalAttemptsElement = document.getElementById('total-attempts');
    const totalTimeElement = document.getElementById('total-time');
    const attemptsPerSecondElement = document.getElementById('attempts-per-second');
    const failedMessageElement = document.getElementById('failed-message');
    
    let pollingInterval;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const password = document.getElementById('password').value;
        const maxLength = document.getElementById('max-length').value;
        const useDigits = document.getElementById('use-digits').checked;
        const useLowercase = document.getElementById('use-lowercase').checked;
        const useUppercase = document.getElementById('use-uppercase').checked;
        const useSpecial = document.getElementById('use-special').checked;
        const hashType = document.getElementById('hash-type').value;
        
        // Validate input
        if (!password) {
            alert('Please enter a password to crack');
            return;
        }
        
        if (!useDigits && !useLowercase && !useUppercase && !useSpecial) {
            alert('Please select at least one character set');
            return;
        }
        
        // Reset UI
        resetUI();
        
        // Show progress container
        progressContainer.classList.remove('d-none');
        startButton.classList.add('d-none');
        stopButton.classList.remove('d-none');
        
        // Start the brute force attack
        fetch('/brute_force', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                password: password,
                max_length: maxLength,
                use_digits: useDigits,
                use_lowercase: useLowercase,
                use_uppercase: useUppercase,
                use_special: useSpecial,
                hash_type: hashType
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'started') {
                statusElement.textContent = 'Starting...';
                startPolling();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            statusElement.textContent = 'Error starting the brute force attack';
        });
    });
    
    stopButton.addEventListener('click', function() {
        fetch('/stop')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'stopped') {
                statusElement.textContent = 'Stopped by user';
                clearInterval(pollingInterval);
                resetButtons();
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
    
    function startPolling() {
        pollingInterval = setInterval(checkProgress, 500);
    }
    
    function checkProgress() {
        fetch('/progress')
        .then(response => response.json())
        .then(data => {
            if (data.status) {
                updateProgress(data);
                
                if (data.status === 'completed') {
                    // Password cracked
                    showResult(data);
                    clearInterval(pollingInterval);
                    resetButtons();
                } else if (data.status === 'failed') {
                    // Failed to crack
                    showFailed(data);
                    clearInterval(pollingInterval);
                    resetButtons();
                } else if (data.status === 'stopped') {
                    // Stopped by user
                    clearInterval(pollingInterval);
                    resetButtons();
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
    
    function updateProgress(data) {
        if (data.attempts) {
            attemptsElement.textContent = data.attempts.toLocaleString();
        }
        
        if (data.elapsed) {
            elapsedElement.textContent = data.elapsed.toFixed(2);
        }
        
        if (data.current_prefix) {
            currentAttemptElement.textContent = data.current_prefix + '...';
        }
        
        // Update status message
        if (data.status === 'running') {
            statusElement.textContent = `Trying ${data.current_length}-character passwords...`;
            statusElement.className = 'alert alert-info';
        } else if (data.status === 'completed') {
            statusElement.textContent = 'Password cracked!';
            statusElement.className = 'alert alert-success';
        } else if (data.status === 'failed') {
            statusElement.textContent = 'Failed to crack password';
            statusElement.className = 'alert alert-warning';
        } else if (data.status === 'stopped') {
            statusElement.textContent = 'Stopped by user';
            statusElement.className = 'alert alert-secondary';
        }
        
        // Fake progress bar (since we don't know the total number of attempts needed)
        if (data.status === 'running') {
            const randomIncrement = Math.random() * 5;
            const currentWidth = parseFloat(progressBar.style.width) || 0;
            const newWidth = Math.min(currentWidth + randomIncrement, 90); // Cap at 90%
            progressBar.style.width = newWidth + '%';
            progressBar.setAttribute('aria-valuenow', newWidth);
        } else if (data.status === 'completed') {
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            progressBar.className = 'progress-bar bg-success';
        } else if (data.status === 'failed' || data.status === 'stopped') {
            progressBar.className = 'progress-bar bg-secondary';
        }
    }
    
    function showResult(data) {
        progressContainer.classList.add('d-none');
        resultContainer.classList.remove('d-none');
        
        crackedPasswordElement.textContent = data.password;
        totalAttemptsElement.textContent = data.attempts.toLocaleString();
        totalTimeElement.textContent = data.elapsed.toFixed(2);
        attemptsPerSecondElement.textContent = Math.round(data.attempts_per_second).toLocaleString();
    }
    
    function showFailed(data) {
        progressContainer.classList.add('d-none');
        failedContainer.classList.remove('d-none');
        
        failedMessageElement.textContent = data.message;
    }
    
    function resetButtons() {
        startButton.classList.remove('d-none');
        stopButton.classList.add('d-none');
    }
    
    function resetUI() {
        progressContainer.classList.add('d-none');
        resultContainer.classList.add('d-none');
        failedContainer.classList.add('d-none');
        
        statusElement.textContent = 'Waiting to start...';
        statusElement.className = 'alert alert-info';
        
        attemptsElement.textContent = '0';
        elapsedElement.textContent = '0';
        currentAttemptElement.textContent = '-';
        
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    }
});