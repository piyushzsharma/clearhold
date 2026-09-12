import { PrismaClient } from '@prisma/client';
import { releaseEscrowFunds } from '../src/lib/ledger.js';

const prisma = new PrismaClient();

async function runConcurrencyTest() {
  console.log('--- STARTING CONCURRENCY TEST (500 PARALLEL RUNS) ---');

  // 1. Setup mock users
  const buyer = await prisma.user.create({
    data: {
      name: 'Test Buyer',
      email: `buyer_${Date.now()}@test.com`,
      password: 'hash',
      role: 'CLIENT',
      wallet: { create: {} }
    }
  });

  const seller = await prisma.user.create({
    data: {
      name: 'Test Seller',
      email: `seller_${Date.now()}@test.com`,
      password: 'hash',
      role: 'CLIENT',
      wallet: { create: {} }
    }
  });

  // 2. Setup mock escrow in VERIFICATION_WINDOW with $100 value
  const escrow = await prisma.escrowTransaction.create({
    data: {
      title: 'Concurrency Test Escrow',
      priceCents: 10000, // $100.00
      buyerId: buyer.id,
      sellerId: seller.id,
      status: 'VERIFICATION_WINDOW',
    }
  });

  // Give the buyer $100 HELD via Ledger
  await prisma.ledgerEntry.create({
    data: {
      escrowId: escrow.id,
      accountId: buyer.id,
      entryType: 'CREDIT',
      amountCents: 10000,
      balanceBucket: 'HELD',
      reason: 'TEST_SEED',
      idempotencyKey: `seed_${Date.now()}`
    }
  });

  console.log(`Created Escrow ${escrow.id} between Buyer ${buyer.id} and Seller ${seller.id}`);

  // 3. Define the exact transaction block from our API
  const attemptRelease = async (runIndex) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock row
        const escrowRows = await tx.$queryRaw`
          SELECT status, "buyerId", "sellerId", "priceCents" FROM escrow_transactions WHERE id = ${escrow.id} FOR UPDATE
        `;
        
        const currentEscrow = escrowRows[0];

        // Assert valid state
        if (currentEscrow.status !== 'VERIFICATION_WINDOW') {
          throw new Error(`State is ${currentEscrow.status} - Already released!`);
        }

        // Release funds
        await releaseEscrowFunds(tx, {
          buyerId: currentEscrow.buyerId,
          sellerId: currentEscrow.sellerId,
          escrowId: escrow.id,
          amountCents: currentEscrow.priceCents,
          idempotencyKeyPrefix: `test_release:${escrow.id}`,
        });

        // Update status
        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED' }
        });
      });

      return { status: 'SUCCESS', runIndex };
    } catch (error) {
      return { status: 'FAILED', reason: error.message, runIndex };
    }
  };

  console.log('Spawning 500 concurrent release requests...');
  
  // 4. Fire 500 requests at the EXACT same millisecond
  const promises = [];
  for (let i = 0; i < 500; i++) {
    promises.push(attemptRelease(i));
  }

  const results = await Promise.all(promises);

  // 5. Assert results
  const successes = results.filter(r => r.status === 'SUCCESS');
  const failures = results.filter(r => r.status === 'FAILED');

  console.log('\n--- RESULTS ---');
  console.log(`Successful Releases: ${successes.length} (Expected: 1)`);
  console.log(`Blocked Double-Spends: ${failures.length} (Expected: 499)`);

  if (successes.length === 1 && failures.length === 499) {
    console.log('\n✅ TEST PASSED: Zero double-spend incidents. Row-level locking worked perfectly.');
  } else {
    console.error('\n❌ TEST FAILED: Race condition detected!');
  }

  // Cleanup
  await prisma.ledgerEntry.deleteMany({ where: { escrowId: escrow.id } });
  await prisma.escrowTransaction.delete({ where: { id: escrow.id } });
  await prisma.wallet.deleteMany({ where: { userId: { in: [buyer.id, seller.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [buyer.id, seller.id] } } });

  await prisma.$disconnect();
}

runConcurrencyTest().catch(e => {
  console.error(e);
  process.exit(1);
});
