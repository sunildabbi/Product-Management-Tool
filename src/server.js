import dotenv from 'dotenv';
dotenv.config();

import { buildApp } from './app.js';

const PORT = process.env.PORT || 8080;
const app = buildApp();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});