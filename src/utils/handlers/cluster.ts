import cluster from 'cluster';
import os from 'os';

// Get number of CPU cores for optimal clustering
const numCPUs = os.cpus().length;

class ClusterManager {
  private isMaster: boolean;
  private workers: any[] = [];

  constructor() {
    this.isMaster = cluster.isPrimary;
  }

  start(): void {
    if (this.isMaster) {
      console.log(`🚀 Starting master process with ${numCPUs} CPU cores`);
      this.setupMaster();
    } else {
      console.log(`👷 Worker ${process.pid} started`);
      this.setupWorker();
    }
  }

  private setupMaster(): void {
    console.log(`📊 Master ${process.pid} is running`);

    // Fork workers for each CPU core
    for (let i = 0; i < numCPUs; i++) {
      const worker = cluster.fork();
      this.workers.push(worker);

      // Handle worker events
      worker.on('online', () => {
        console.log(`✅ Worker ${worker.process.pid} is online`);
      });

      worker.on('exit', (code, signal) => {
        console.log(`❌ Worker ${worker.process.pid} died with code: ${code}, signal: ${signal}`);

        // Restart worker if it dies unexpectedly
        if (code !== 0) {
          console.log('🔄 Restarting worker...');
          const newWorker = cluster.fork();
          this.workers.push(newWorker);
        }
      });

      worker.on('message', (message) => {
        console.log(`📨 Message from worker ${worker.process.pid}:`, message);
      });
    }

    // Handle master process events
    process.on('SIGTERM', () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      this.workers.forEach(worker => worker.kill());
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      this.workers.forEach(worker => worker.kill());
      process.exit(0);
    });
  }

  private setupWorker(): void {
    // Worker process setup is handled in the main application
    // The worker will run the Express server
  }

  getWorkerCount(): number {
    return this.workers.length;
  }

  broadcast(message: any): void {
    this.workers.forEach(worker => {
      worker.send(message);
    });
  }
}

export const clusterManager = new ClusterManager();
export default clusterManager;
