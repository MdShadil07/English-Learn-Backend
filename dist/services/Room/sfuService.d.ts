import type { Router, RtpCapabilities } from 'mediasoup/types';
export declare class SFUService {
    private workers;
    private nextWorkerIndex;
    private rooms;
    private workersReady;
    constructor();
    private initializeWorkers;
    private getNextWorker;
    getOrCreateRouter(roomId: string): Promise<Router>;
    createWebRtcTransport(roomId: string, userId: string): Promise<any>;
    connectTransport(roomId: string, transportId: string, dtlsParameters: any): Promise<void>;
    createProducer(roomId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: any, userId: string): Promise<string>;
    createConsumer(roomId: string, transportId: string, producerId: string, rtpCapabilities: RtpCapabilities): Promise<any>;
    removeUser(roomId: string, userId: string): void;
    resumeConsumer(roomId: string, consumerId: string): Promise<void>;
    getProducers(roomId: string): {
        id: string;
        userId: string;
        kind: string;
    }[];
    shutdown(): Promise<void>;
}
export declare const sfuService: SFUService;
export default sfuService;
//# sourceMappingURL=sfuService.d.ts.map