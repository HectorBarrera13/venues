const { prisma } = require('../src/database/prisma');

async function main() {
  try {
    await prisma.$connect();
    await prisma.$runCommandRaw({ ping: 1 });
    console.log('MongoDB connection is ready');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('MongoDB connection failed:', error.message);
  process.exitCode = 1;
});
