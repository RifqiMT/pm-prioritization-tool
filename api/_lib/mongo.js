const { MongoClient } = require("mongodb");

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    ""
  );
}

const uri = getMongoUri();
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
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });
    const globalKey = "_pmMongoClientPromise";
    if (!global[globalKey]) {
      global[globalKey] = client.connect();
    }
    clientPromise = global[globalKey];
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

module.exports = {
  isMongoConfigured,
  getDb
};
