// MongoDB Replica Set Initialization Script
// This script initializes a MongoDB replica set for high availability

// Wait for MongoDB to be ready
sleep(10000);

// Connect to MongoDB
const conn = new Mongo();
const db = conn.getDB("admin");

// Initialize replica set
try {
  const config = {
    _id: "rs0",
    members: [
      {
        _id: 0,
        host: "localhost:27017"
      }
    ]
  };

  rs.initiate(config);
  print("✅ Replica set initialized successfully");
} catch (error) {
  print("⚠️ Replica set initialization failed:", error.message);
  // This is expected if replica set is already initialized
}

// Create application database and collections
db = conn.getDB("english-practice");

// Create indexes for optimal performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true, sparse: true });
db.users.createIndex({ role: 1, createdAt: -1 });

db.userprofiles.createIndex({ userId: 1 }, { unique: true });
db.userprofiles.createIndex({ isPremium: 1, lastActivityAt: -1 });
db.userprofiles.createIndex({ targetLanguage: 1, experienceLevel: 1 });
db.userprofiles.createIndex({
  displayName: 'text',
  username: 'text',
  bio: 'text',
  targetLanguage: 'text'
}, {
  weights: {
    displayName: 10,
    username: 10,
    bio: 8,
    targetLanguage: 6
  }
});

db.progress.createIndex({ userId: 1, lessonId: 1 });
db.progress.createIndex({ userId: 1, completedAt: -1 });

db.userlevels.createIndex({ userId: 1 }, { unique: true });
db.userlevels.createIndex({ totalXP: -1, level: -1 });

db.refreshtokens.createIndex({ token: 1 }, { unique: true });
db.refreshtokens.createIndex({ userId: 1, expiresAt: 1 });
db.refreshtokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

print("✅ Database indexes created successfully");

// Close connection
conn.close();
