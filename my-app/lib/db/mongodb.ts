import { MongoClient } from "mongodb";

function buildMongoUri() {
  const user = process.env.MONGO_USERNAME;
  const pass = process.env.MONGO_PASSWORD;
  const host = process.env.MONGODB_HOST;

  if (!user) throw new Error("Missing MONGO_USERNAME in .env.local");
  if (!pass) throw new Error("Missing MONGO_PASSWORD in .env.local");
  if (!host) throw new Error("Missing MONGODB_HOST in .env.local");

  // IMPORTANT: encode in case password has special chars
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(pass);

  return `mongodb+srv://${u}:${p}@${host}/?retryWrites=true&w=majority&appName=Questions`;
}

const uri = buildMongoUri();

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb() {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) throw new Error("Missing MONGODB_DB in .env.local");

  const client = await clientPromise;
  return client.db(dbName);
}
