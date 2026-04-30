export interface SocketRedisClients {
    pubClient: any;
    subClient: any;
}
export declare const createSocketRedisClients: () => Promise<SocketRedisClients | null>;
export declare const closeSocketRedisClients: (clients: SocketRedisClients | null) => Promise<void>;
//# sourceMappingURL=socketRedis.d.ts.map