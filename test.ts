import { prisma } from './src/lib/prisma';
async function run() {
  try {
    const tags = await prisma.specializationTag.findMany();
    console.log("TAGS:", tags);
  } catch (err) {
    console.error("DB Error:", err);
  }
}
run();
