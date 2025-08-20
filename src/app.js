import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorMiddleware } from './utils/errors.js';
import routes from './routes/index.js';
import { runMigrations } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp() {

  runMigrations();

  const app = express();
  app.use(helmet());
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));


  const swaggerPath = path.resolve(__dirname, '..', 'swagger.json');
  if (fs.existsSync(swaggerPath)) {
    const swaggerDoc = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  }

  app.use('/api', routes);


  app.use(errorMiddleware);

  return app;
}