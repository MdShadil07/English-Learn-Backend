declare class ClusterManager {
    private isMaster;
    private workers;
    constructor();
    start(): void;
    private setupMaster;
    private setupWorker;
    getWorkerCount(): number;
    broadcast(message: any): void;
}
export declare const clusterManager: ClusterManager;
export default clusterManager;
//# sourceMappingURL=cluster.d.ts.map