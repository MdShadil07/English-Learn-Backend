import * as mediasoup from 'mediasoup';
import * as os from 'os';
import { mediasoupConfig } from '../../config/mediasoup.js';
export class SFUService {
    workers = [];
    nextWorkerIndex = 0;
    rooms = new Map();
    workersReady;
    isOverloaded = false;
    monitorInterval;
    constructor() {
        this.workersReady = this.initializeWorkers();
        this.monitorInterval = this.startResourceMonitor();
    }
    startResourceMonitor() {
        return setInterval(() => {
            const loadAvg = os.loadavg()[0]; // 1-minute load average
            const numCpus = os.cpus().length;
            const loadPercentage = loadAvg / numCpus;
            const wasOverloaded = this.isOverloaded;
            // Overload threshold: 85% CPU load
            this.isOverloaded = loadPercentage > 0.85;
            if (this.isOverloaded && !wasOverloaded) {
                console.warn('⚠️ SFU Node overloaded. Enabling graceful degradation (audio-only mode).');
                this.enableGracefulDegradation();
            }
            else if (!this.isOverloaded && wasOverloaded) {
                console.info('✅ SFU Node recovered from overload. Resuming normal operations.');
                this.disableGracefulDegradation();
            }
        }, 10000); // Check every 10 seconds
    }
    async enableGracefulDegradation() {
        for (const room of this.rooms.values()) {
            for (const consumer of room.consumers.values()) {
                if (consumer.kind === 'video') {
                    try {
                        // Force lower simulcast layers to save bandwidth/CPU
                        await consumer.setPreferredLayers({ spatialLayer: 0, temporalLayer: 0 });
                        // Alternatively, could pause video entirely: await consumer.pause();
                    }
                    catch (error) {
                        console.error('Error lowering simulcast layers', error);
                    }
                }
            }
        }
    }
    async disableGracefulDegradation() {
        for (const room of this.rooms.values()) {
            for (const consumer of room.consumers.values()) {
                if (consumer.kind === 'video') {
                    try {
                        // Restore default preferred layers
                        await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
                    }
                    catch (error) {
                        console.error('Error restoring simulcast layers', error);
                    }
                }
            }
        }
    }
    async initializeWorkers() {
        const { numWorkers, worker: workerSettings } = mediasoupConfig;
        console.log(`🚀 Initializing ${numWorkers} mediasoup workers...`);
        for (let i = 0; i < numWorkers; i++) {
            const worker = await mediasoup.createWorker(workerSettings);
            worker.on('died', () => {
                console.error('mediasoup worker died, exiting... [pid:%d]', worker.pid);
                setTimeout(() => process.exit(1), 2000);
            });
            this.workers.push(worker);
        }
    }
    async getNextWorker() {
        await this.workersReady;
        if (this.workers.length === 0) {
            throw new Error('Mediasoup workers are not available');
        }
        const worker = this.workers[this.nextWorkerIndex];
        this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
        return worker;
    }
    async getOrCreateRouter(roomId) {
        await this.workersReady;
        let room = this.rooms.get(roomId);
        if (!room) {
            const worker = await this.getNextWorker();
            const router = await worker.createRouter(mediasoupConfig.router);
            room = {
                router,
                transports: new Map(),
                producers: new Map(),
                consumers: new Map(),
                participantTransports: new Map(),
            };
            this.rooms.set(roomId, room);
            router.on('workerclose', () => this.rooms.delete(roomId));
        }
        return room.router;
    }
    async createWebRtcTransport(roomId, userId) {
        const router = await this.getOrCreateRouter(roomId);
        const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);
        const room = this.rooms.get(roomId);
        room.transports.set(transport.id, transport);
        const userTransports = room.participantTransports.get(userId) || new Set();
        userTransports.add(transport.id);
        room.participantTransports.set(userId, userTransports);
        transport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'closed')
                transport.close();
        });
        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
        };
    }
    async connectTransport(roomId, transportId, dtlsParameters) {
        const transport = this.rooms.get(roomId)?.transports.get(transportId);
        if (!transport)
            throw new Error('Transport not found');
        await transport.connect({ dtlsParameters });
    }
    async createProducer(roomId, transportId, kind, rtpParameters, userId) {
        const room = this.rooms.get(roomId);
        const transport = room?.transports.get(transportId);
        if (!transport)
            throw new Error('Transport not found');
        if (kind === 'video' && this.isOverloaded) {
            throw new Error('SFU is currently overloaded. Video publishing is temporarily disabled.');
        }
        const producer = await transport.produce({
            kind,
            rtpParameters,
            appData: { userId, transportId }
        });
        room.producers.set(producer.id, producer);
        producer.on('transportclose', () => {
            producer.close();
            room.producers.delete(producer.id);
        });
        return producer.id;
    }
    async createConsumer(roomId, transportId, producerId, rtpCapabilities) {
        const room = this.rooms.get(roomId);
        if (!room || !room.router.canConsume({ producerId, rtpCapabilities })) {
            throw new Error('Cannot consume');
        }
        const transport = room.transports.get(transportId);
        if (!transport)
            throw new Error('Transport not found');
        const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true,
        });
        room.consumers.set(consumer.id, consumer);
        consumer.on('transportclose', () => room.consumers.delete(consumer.id));
        consumer.on('producerclose', () => room.consumers.delete(consumer.id));
        return {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
        };
    }
    removeUser(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const userTransports = room.participantTransports.get(userId);
        if (userTransports) {
            userTransports.forEach(id => room.transports.get(id)?.close());
            room.participantTransports.delete(userId);
        }
    }
    async resumeConsumer(roomId, consumerId) {
        const consumer = this.rooms.get(roomId)?.consumers.get(consumerId);
        if (!consumer)
            throw new Error('Consumer not found');
        await consumer.resume();
    }
    getProducers(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return [];
        const results = [];
        room.producers.forEach((producer, id) => {
            // Find which user this transport belongs to
            let userId = 'unknown';
            for (const [uid, transports] of room.participantTransports.entries()) {
                if (transports.has(producer.appData.transportId || '')) {
                    userId = uid;
                    break;
                }
            }
            results.push({
                id,
                userId: producer.appData.userId || 'unknown',
                kind: producer.kind
            });
        });
        return results;
    }
    async shutdown() {
        clearInterval(this.monitorInterval);
        await Promise.all(this.workers.map((worker) => worker.close()));
        this.workers = [];
    }
    // --- Transport Recovery Features ---
    async restartIce(roomId, transportId) {
        const transport = this.rooms.get(roomId)?.transports.get(transportId);
        if (!transport)
            throw new Error('Transport not found');
        const iceParameters = await transport.restartIce();
        return iceParameters;
    }
    async recreateConsumer(roomId, transportId, producerId, rtpCapabilities) {
        // If a transport or consumer dropped due to DTLS/network errors, clients can request a recreate
        const room = this.rooms.get(roomId);
        if (!room)
            throw new Error('Room not found');
        // Cleanup old consumer if it exists for this producer on this transport
        for (const [id, consumer] of room.consumers.entries()) {
            if (consumer.producerId === producerId && consumer.appData.transportId === transportId) {
                consumer.close();
                room.consumers.delete(id);
            }
        }
        return this.createConsumer(roomId, transportId, producerId, rtpCapabilities);
    }
}
export const sfuService = new SFUService();
export default sfuService;
//# sourceMappingURL=sfuService.js.map