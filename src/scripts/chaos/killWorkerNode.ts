import { execSync } from 'child_process';

console.log('🔥 Chaos Testing: Simulating Mediasoup Worker Node Death');
console.log('Finding Mediasoup worker processes...');

try {
  // Find Mediasoup worker PIDs
  // Note: This works on Linux/macOS. For Windows, we use tasklist/taskkill.
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    const output = execSync('tasklist | findstr "mediasoup-worker"').toString();
    console.log('Workers found:\n', output);
    
    // Kill the first one to simulate partial failure
    const lines = output.trim().split('\n');
    if (lines.length > 0 && lines[0]) {
      const pid = lines[0].trim().split(/\s+/)[1];
      console.log(`Killing worker with PID: ${pid}`);
      execSync(`taskkill /F /PID ${pid}`);
      console.log('Worker killed successfully. Check SFU recovery logs.');
    } else {
      console.log('No mediasoup workers found.');
    }
  } else {
    const output = execSync('pgrep -f "mediasoup-worker"').toString();
    const pids = output.trim().split('\n');
    if (pids.length > 0 && pids[0]) {
      console.log(`Killing worker with PID: ${pids[0]}`);
      execSync(`kill -9 ${pids[0]}`);
      console.log('Worker killed successfully. Check SFU recovery logs.');
    } else {
      console.log('No mediasoup workers found.');
    }
  }
} catch (error) {
  console.error('Failed to kill worker:', error);
}
