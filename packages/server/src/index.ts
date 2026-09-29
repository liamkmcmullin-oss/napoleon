import { startServer } from './server.js';

const port = Number(process.env.PORT ?? 8080);
startServer(port);
console.log(`Napoleon server listening on ws://localhost:${port}`);
