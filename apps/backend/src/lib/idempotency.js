import { NextResponse } from 'next/server';
import Redis from 'ioredis';

// Ensure redis is only initialized once in dev
const globalForRedis = globalThis;
const redis = globalForRedis.redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export function withIdempotency(handler) {
  return async (req, ...args) => {
    // Only apply idempotency to mutating requests
    if (req.method === 'GET' || req.method === 'HEAD') {
      return handler(req, ...args);
    }

    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header is required for mutating requests' }, { status: 400 });
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    
    // Check if key exists
    const existing = await redis.get(cacheKey);
    if (existing) {
      const data = JSON.parse(existing);
      if (data.status === 'processing') {
        return NextResponse.json({ error: 'Request is currently processing' }, { status: 409 });
      }
      // Return cached response
      return NextResponse.json(data.responseBody, { status: data.statusCode });
    }

    // Set as processing (expires in 5 minutes to prevent deadlocks)
    await redis.set(cacheKey, JSON.stringify({ status: 'processing' }), 'EX', 300);

    try {
      const response = await handler(req, ...args);
      
      // Clone response to read JSON body without consuming the original response
      let responseBody = {};
      try {
        const clonedResponse = response.clone();
        responseBody = await clonedResponse.json();
      } catch (e) {
        // If response is not JSON or cannot be cloned, ignore
      }

      // Cache the response
      await redis.set(
        cacheKey,
        JSON.stringify({ 
          status: 'done', 
          statusCode: response.status, 
          responseBody 
        }),
        'EX',
        86400 // Keep idempotency key valid for 24 hours
      );

      return response;
    } catch (error) {
      // If an unhandled error occurs, remove the key so the user can retry
      await redis.del(cacheKey);
      throw error;
    }
  };
}
