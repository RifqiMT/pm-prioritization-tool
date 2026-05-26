const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "pm_prioritization";

/** @type {Promise<MongoClient> | null} */
let clientPromise = null;

function isMongoConfigured() {
  return Boolean(uri && String(uri).trim());
}

function getClientPromise() {
  if (!isMongoConfigured()) {
    return Promise.reject(new Error("MONGODB_URI is not configured"));
  }
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5
    });
    if (process.env.NODE_ENV === "development") {
      if (!global._pmMongoClientPromise) {
        global._pmMongoClientPromise = client.connect();
      }
      clientPromise = global._pmMongoClientPromise;
    } else {
      clientPromise = client.connect();
    }
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

module.exports = {
  isMongoConfigured,
  getDb,
  dbName
};
