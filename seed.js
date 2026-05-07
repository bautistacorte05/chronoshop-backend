import { connect, disconnect } from 'mongoose';
import 'dotenv/config';
import { Product } from './src/models/Product.js';

const products = [
  {
    title: 'Casio G-Shock GA-2100',
    description: 'Reloj deportivo ultrarresistente con caja octogonal inspirada en el carbono. Protección contra golpes y resistencia al agua hasta 200m. El icónico "CasiOak".',
    code: 'CASIO-GA2100-BLK',
    price: 99,
    status: true,
    stock: 20,
    category: 'Sport',
    thumbnails: ['/images/casio-ga2100.jpg'],
  },
  {
    title: 'Casio Edifice EFR-552',
    description: 'Cronógrafo analógico multifunción con bisel negro y acabado en acero inoxidable. Diseño ejecutivo de alto rendimiento.',
    code: 'CASIO-EFR552-BLK',
    price: 130,
    status: true,
    stock: 15,
    category: 'Dress',
    thumbnails: ['/images/casio-efr552.jpg'],
  },
  {
    title: 'Casio Vintage A168W',
    description: 'Icónico reloj digital retro con caja de acero y pantalla LED. Un clásico atemporal que no ha cambiado desde los años 80.',
    code: 'CASIO-A168W-SLV',
    price: 85,
    status: true,
    stock: 25,
    category: 'Casual',
    thumbnails: ['/images/casio-a168w.jpg'],
  },
  {
    title: 'Seiko 5 Sports SNKE49',
    description: 'Automático con movimiento 7S26, esfera marrón con índices dorados y correa de cuero. El clásico accesible del segmento automático.',
    code: 'SEIKO-SNKE49-BRN',
    price: 180,
    status: true,
    stock: 12,
    category: 'Sport',
    thumbnails: ['/images/seiko-snke49.jpg'],
  },
  {
    title: 'Seiko Presage SRPE41',
    description: 'Automático con esfera azul "pétalo de sakura" y acabados combinados pulido/cepillado. Movimiento de 45h de reserva de marcha.',
    code: 'SEIKO-SRPE41-BLU',
    price: 320,
    status: true,
    stock: 8,
    category: 'Dress',
    thumbnails: ['/images/seiko-srpe41.jpg'],
  },
  {
    title: 'Seiko Prospex SPB051',
    description: 'Automático diver inspirado en el histórico 62MAS. Esfera negra con índices luminosos, resistente hasta 200m de profundidad.',
    code: 'SEIKO-SPB051-BLK',
    price: 650,
    status: true,
    stock: 5,
    category: 'Sport',
    thumbnails: ['/images/seiko-spb051.jpg'],
  },
  {
    title: 'Fossil Machine FS5343',
    description: 'Analógico de tres agujas con bisel pulsador y caja de 45mm en acero plateado. Esfera azul con estilo industrial moderno.',
    code: 'FOSSIL-FS5343-SLV',
    price: 155,
    status: true,
    stock: 18,
    category: 'Casual',
    thumbnails: ['/images/fossil-fs5343.jpg'],
  },
  {
    title: 'Fossil Gen 6 FTW4059',
    description: 'Smartwatch con Wear OS, chip Snapdragon 4100+, monitoreo de salud avanzado y carga rápida. Caja de 44mm en acero con correa de silicona.',
    code: 'FOSSIL-FTW4059-BLK',
    price: 249,
    status: true,
    stock: 10,
    category: 'Smart',
    thumbnails: ['/images/fossil-ftw4059.jpg'],
  },
  {
    title: 'Tissot T-Classic T063',
    description: 'Cuarzo suizo ETA con esfera plateada y brazalete de acero. Cristal de zafiro, diseño clásico y resistencia al agua de 30m.',
    code: 'TISSOT-T063-SLV',
    price: 350,
    status: true,
    stock: 7,
    category: 'Dress',
    thumbnails: ['/images/tissot-t063.jpg'],
  },
  {
    title: 'Tissot PRX Automatic',
    description: 'Automático con esfera azul y brazalete integrado de acero. Inspirado en el original de 1978, movimiento Powermatic 80 con 80h de autonomía.',
    code: 'TISSOT-PRX-BLU',
    price: 550,
    status: true,
    stock: 6,
    category: 'Dress',
    thumbnails: ['/images/tissot-prx.jpg'],
  },
];

await connect(process.env.MONGODB_URI);
await Product.deleteMany({});
const inserted = await Product.insertMany(products);
console.log(`✓ ${inserted.length} relojes insertados en MongoDB`);
await disconnect();
