import mongoose from 'mongoose';
interface DatabaseConfig {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    isConnected: () => boolean;
}
declare class DatabaseConnection implements DatabaseConfig {
    private connection;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getConnection(): mongoose.Connection;
}
export declare const database: DatabaseConnection;
export default database;
//# sourceMappingURL=database.d.ts.map