import * as mediasoup from 'mediasoup';
import { mediasoupConfig } from '../../config/mediasoup.js';
export class SFUService {
    workers = [];
    nextWorkerIndex = 0;
    rooms = new Map();
    workersReady;
    constructor() {
        this.workersReady = this.initializeWorkers();
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
        await Promise.all(this.workers.map((worker) => worker.close()));
        this.workers = [];
    }
}
export const sfuService = new SFUService();
export default sfuService;
//# sourceMappingURL=sfuService.js.map