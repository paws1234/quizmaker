import mongoose from 'mongoose';

/**
 * A single cached Mongoose connection.
 *
 * Next.js can evaluate this module more than once (route handler bundles, dev
 * server reloads), and every extra connection counts against the server's
 * connection limit, so the handle is parked on globalThis.
 */

type Cache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __quizMongoose: Cache | undefined;
}

const cache: Cache = (globalThis.__quizMongoose ??= { conn: null, promise: null });

function connectionString(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Start the app with `docker compose up` (see README) ' +
        'or export MONGODB_URI yourself.',
    );
  }
  return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(connectionString(), {
      // Fail inside a request instead of hanging forever when mongo is down.
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Let the next request try again rather than caching a rejected promise.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
