import { MongoClient, MongoServerError } from 'mongodb';

const address = process.env.MONGO_INIT_URL || 'mongodb://127.0.0.1:27017/?directConnection=true';
const client = new MongoClient(address, { serverSelectionTimeoutMS: 5000 });

async function main(): Promise<void> {
  try {
    await client.connect();
    const admin = client.db('admin');

    try {
      await admin.command({ replSetGetStatus: 1 });
      console.log('MongoDB replica set is already initialized');
      return;
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 94) throw error;
    }

    await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27017' }],
      },
    });
    console.log('MongoDB replica set rs0 initialized');
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error('MongoDB initialization failed:', error);
  process.exitCode = 1;
});
