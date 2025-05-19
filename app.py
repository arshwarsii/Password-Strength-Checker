# app.py
from flask import Flask, render_template, request, jsonify
import hashlib
import itertools
import string
import time
import threading
import queue

app = Flask(__name__)

# Queue for tracking progress between threads
progress_queue = queue.Queue()
stop_event = threading.Event()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/brute_force', methods=['POST'])
def brute_force():
    data = request.get_json()
    password = data.get('password', '')
    max_length = int(data.get('max_length', 4))
    use_digits = data.get('use_digits', True)
    use_lowercase = data.get('use_lowercase', True)
    use_uppercase = data.get('use_uppercase', False)
    use_special = data.get('use_special', False)
    hash_type = data.get('hash_type', 'plain')
    
    # Reset the stop event and progress queue
    stop_event.clear()
    while not progress_queue.empty():
        progress_queue.get()
    
    # Start the brute force in a separate thread
    threading.Thread(
        target=brute_force_worker, 
        args=(password, max_length, use_digits, use_lowercase, use_uppercase, use_special, hash_type)
    ).start()
    
    return jsonify({'status': 'started'})

@app.route('/progress')
def get_progress():
    if not progress_queue.empty():
        return jsonify(progress_queue.get())
    return jsonify({'status': 'waiting'})

@app.route('/stop')
def stop_brute_force():
    stop_event.set()
    return jsonify({'status': 'stopped'})

def hash_password(password, hash_type):
    if hash_type == 'plain':
        return password
    elif hash_type == 'md5': # DevSkim: ignore DS126858
        return hashlib.md5(password.encode()).hexdigest()
    elif hash_type == 'sha1': # DevSkim: ignore DS126858
        return hashlib.sha(password.encode()).hexdigest()
    elif hash_type == 'sha256':
        return hashlib.sha256(password.encode()).hexdigest()

def brute_force_worker(password, max_length, use_digits, use_lowercase, use_uppercase, use_special, hash_type):
    # Create the character set based on user options
    charset = ''
    if use_digits:
        charset += string.digits
    if use_lowercase:
        charset += string.ascii_lowercase
    if use_uppercase:
        charset += string.ascii_uppercase
    if use_special:
        charset += string.punctuation
    
    # If no character types are selected, default to digits
    if not charset:
        charset = string.digits
    
    # Hash the target password
    target_hash = hash_password(password, hash_type)
    
    # Statistics
    start_time = time.time()
    attempts = 0
    found = False
    
    # Try all possible combinations
    for length in range(1, max_length + 1):
        if stop_event.is_set():
            progress_queue.put({
                'status': 'stopped', 
                'attempts': attempts,
                'elapsed': time.time() - start_time
            })
            return
            
        for attempt in itertools.product(charset, repeat=length):
            attempts += 1
            
            # Update progress every 1000 attempts
            if attempts % 1000 == 0:
                progress_queue.put({
                    'status': 'running',
                    'attempts': attempts,
                    'current_length': length,
                    'current_prefix': ''.join(attempt)[:3],
                    'elapsed': time.time() - start_time
                })
                
                if stop_event.is_set():
                    progress_queue.put({
                        'status': 'stopped', 
                        'attempts': attempts,
                        'elapsed': time.time() - start_time
                    })
                    return
            
            # Convert the attempt to a string
            attempt_str = ''.join(attempt)
            
            # Check if this attempt matches the target
            if hash_password(attempt_str, hash_type) == target_hash:
                found = True
                elapsed = time.time() - start_time
                progress_queue.put({
                    'status': 'completed',
                    'password': attempt_str,
                    'attempts': attempts,
                    'elapsed': elapsed,
                    'attempts_per_second': attempts / elapsed if elapsed > 0 else 0
                })
                return
    
    # If we've tried all possibilities up to max_length and not found it
    if not found:
        progress_queue.put({
            'status': 'failed',
            'attempts': attempts,
            'elapsed': time.time() - start_time,
            'message': f"Password not found within {max_length} characters"
        })

if __name__ == '__main__':
    app.run(debug=True)  # Change to False