import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear cartas de prueba con imágenes aleatorias
  const cardUrls = [
    'https://picsum.photos/id/10/300/200',
    'https://picsum.photos/id/20/300/200',
    'https://picsum.photos/id/30/300/200',
    'https://picsum.photos/id/40/300/200',
    'https://picsum.photos/id/50/300/200',
    'https://picsum.photos/id/60/300/200',
    'https://picsum.photos/id/70/300/200',
    'https://picsum.photos/id/80/300/200',
    'https://picsum.photos/id/90/300/200',
    'https://picsum.photos/id/100/300/200',
    'https://picsum.photos/id/110/300/200',
    'https://picsum.photos/id/120/300/200',
    'https://picsum.photos/id/130/300/200',
    'https://picsum.photos/id/140/300/200',
    'https://picsum.photos/id/150/300/200',
    'https://picsum.photos/id/160/300/200',
    'https://picsum.photos/id/170/300/200',
    'https://picsum.photos/id/180/300/200',
  ];

  console.log('Creando cartas...');
  
  for (const url of cardUrls) {
    await prisma.card.create({
      data: { url }
    });
  }

  const cardCount = await prisma.card.count();
  console.log(`✅ ${cardCount} cartas creadas exitosamente!`);
}

main()
  .catch((e) => {
    console.error('Error al sembrar datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 