import { PrismaClient } from '@prisma/client';
import room from './seed_data/room';
import user from './seed_data/user';

const prisma = new PrismaClient();

const main = async () => {
  await Promise.all(Array(5).fill('').map(async () => {
    await prisma.user.create({
      data: {
        ...(await user()),
        roomsOwned: {
          create: Array(4).fill('').map(() => ({
            ...room(),
          })),
        },
      },
    });
  }));
};

main()
  .catch((e) => {
    console.log(e);
    process.exit(1);
  }).finally(() => {
    prisma.$disconnect();
  });
