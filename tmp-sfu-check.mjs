import { sfuService } from './dist/services/Room/sfuService.js';

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('timeout waiting for workers')), 10000);
  const interval = setInterval(() => {
    if (sfuService.workers?.length > 0) {
      clearTimeout(timeout);
      clearInterval(interval);
      resolve();
    }
  }, 50);
});

console.log('workers ready', sfuService.workers.length);
await sfuService.shutdown();
console.log('shutdown finished');
