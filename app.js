import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { engine } from 'express-handlebars';
import { connect } from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

import { ProductMongoDAO }       from './src/dao/mongo/ProductMongoDAO.js';
import { ProductFileSystemDAO }  from './src/dao/fileSystem/ProductFileSystemDAO.js';
import { CartMongoDAO }          from './src/dao/mongo/CartMongoDAO.js';
import { CartFileSystemDAO }     from './src/dao/fileSystem/CartFileSystemDAO.js';
import { ProductManager }        from './src/managers/ProductManager.js';
import { CartManager }           from './src/managers/CartManager.js';
import { createProductsRouter }      from './src/routes/api/products.router.js';
import { createCartsRouter }         from './src/routes/api/carts.router.js';
import { createProductsViewRouter }  from './src/routes/views/products.router.js';
import { createCartsViewRouter }     from './src/routes/views/carts.router.js';

import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import { UserMongoDAO }         from './src/dao/mongo/UserMongoDAO.js';
import { UserManager }          from './src/managers/UserManager.js';
import { configurePassport }    from './src/config/passport.config.js';
import { createAuthApiRouter }  from './src/routes/api/auth.router.js';
import { createAuthViewRouter } from './src/routes/views/auth.router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(passport.initialize());
app.use(passport.session());

app.engine('handlebars', engine({
  helpers: {
    eq:       (a, b) => a === b,
    multiply: (a, b) => (Number(a) * Number(b)).toFixed(2),
  },
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'src/views'));

const persistence = process.env.PERSISTENCE || 'mongo';
const productDAO = persistence === 'mongo' ? new ProductMongoDAO() : new ProductFileSystemDAO();
const cartDAO    = persistence === 'mongo' ? new CartMongoDAO()    : new CartFileSystemDAO();
const productManager = new ProductManager(productDAO);
const cartManager    = new CartManager(cartDAO);

const userDAO     = new UserMongoDAO();
const userManager = new UserManager(userDAO);
configurePassport(userManager);

app.use('/api/products', createProductsRouter(productManager, io));
app.use('/api/carts',    createCartsRouter(cartManager));
app.use('/products',     createProductsViewRouter(productManager));
app.use('/carts',        createCartsViewRouter(cartManager));
app.use('/api/v1', createAuthApiRouter(userManager));
app.use('/',       createAuthViewRouter(userManager));
app.get('/', (req, res) => res.redirect('/products'));

if (persistence === 'mongo') {
  await connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado');
}

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
