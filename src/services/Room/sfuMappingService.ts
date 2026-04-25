import { redisCache } from '../../config/redis.js';

const DEFAULT_SFU_SERVER_URL = process.env.SFU_SERVER_URL || 'http://localhost:3001';
const ROOM_SFU_TTL_SECONDS = Number(process.env.ROOM_SFU_TTL_SECONDS || 60 * 60 * 24); // 24 hours
const USER_ROOM_TTL_SECONDS = Number(process.env.USER_ROOM_TTL_SECONDS || 60 * 60); // 1 hour
const SFU_NODE_TTL_SECONDS = Number(process.env.SFU_NODE_TTL_SECONDS || 15); // node stays active while heartbeats continue
const SFU_NODE_REGISTRY_KEY = 'sfu:nodes';

interface SFUNodeInfo {
  nodeId: string;
  url: string;
  load: number;
  lastHeartbeat: number;
  status: string;
}

class SFUMappingService {
  private getRoomKey(roomId: string): string {
    return `room:${roomId}:sfu`;
  }

  private getUserKey(userId: string): string {
    return `user:${userId}:room`;
  }

  private getNodeMetaKey(nodeId: string): string {
    return `sfu:node:${nodeId}:meta`;
  }

  private async getActiveSFUNodes(): Promise<SFUNodeInfo[]> {
    const redis = redisCache.getClient();
    if (!redis) {
      console.log('SFU Mapping - No Redis client available');
      return [];
    }

    const raw = await redis.zrange(SFU_NODE_REGISTRY_KEY, 0, -1, 'WITHSCORES');
    console.log('SFU Mapping - Raw Redis data:', raw);
    const nodes: SFUNodeInfo[] = [];

    for (let i = 0; i < raw.length; i += 2) {
      const nodeId = raw[i];
      const load = Number(raw[i + 1]) || 0;
      const metaString = await redis.get(this.getNodeMetaKey(nodeId));
      console.log(`SFU Mapping - Node ${nodeId} metadata:`, metaString);

      if (!metaString) {
        continue;
      }

      try {
        const meta = JSON.parse(metaString) as Partial<SFUNodeInfo>;
        if (!meta.url || meta.status !== 'healthy') {
          console.log(`SFU Mapping - Node ${nodeId} skipped: url=${meta.url}, status=${meta.status}`);
          continue;
        }

        nodes.push({
          nodeId,
          url: meta.url,
          load,
          lastHeartbeat: meta.lastHeartbeat || 0,
          status: meta.status || 'healthy',
        });
      } catch {
        continue;
      }
    }

    console.log('SFU Mapping - Active nodes found:', nodes.length, nodes);
    return nodes;
  }

  private async selectBestNode(): Promise<SFUNodeInfo | null> {
    const activeNodes = await this.getActiveSFUNodes();
    if (activeNodes.length === 0) {
      return null;
    }

    return activeNodes.reduce((best, node) => {
      if (!best) {
        return node;
      }
      return node.load < best.load ? node : best;
    }, activeNodes[0]);
  }

  async assignRoomToSFUServer(roomId: string): Promise<string> {
    const key = this.getRoomKey(roomId);
    const existing = await redisCache.get(key);
    if (existing) {
      console.log(`SFU Mapping - Room ${roomId} already has SFU URL:`, existing);
      return existing;
    }

    const bestNode = await this.selectBestNode();
    const sfuUrl = bestNode?.url || DEFAULT_SFU_SERVER_URL;
    console.log(`SFU Mapping - Assigning room ${roomId} to SFU:`, sfuUrl, 'via node:', bestNode);

    await redisCache.set(key, sfuUrl, ROOM_SFU_TTL_SECONDS);
    return sfuUrl;
  }

  async getSFUServerForRoom(roomId: string): Promise<string> {
    const key = this.getRoomKey(roomId);
    const existing = await redisCache.get(key);
    if (existing) {
      return existing;
    }

    return this.assignRoomToSFUServer(roomId);
  }

  async clearRoomSFUMapping(roomId: string): Promise<void> {
    const key = this.getRoomKey(roomId);
    await redisCache.del(key);
  }

  async assignUserToRoom(userId: string, roomId: string): Promise<void> {
    const key = this.getUserKey(userId);
    await redisCache.set(key, roomId, USER_ROOM_TTL_SECONDS);
  }

  async getRoomForUser(userId: string): Promise<string | null> {
    const key = this.getUserKey(userId);
    return await redisCache.get(key);
  }

  async removeUserRoomMapping(userId: string): Promise<void> {
    const key = this.getUserKey(userId);
    await redisCache.del(key);
  }
}

export const sfuMappingService = new SFUMappingService();
export default sfuMappingService;
