import fastify from 'fastify';
import { registerSessionRoutes } from './routes/sessions';
import dotenv from 'dotenv';

dotenv.config();

const buildServer = async (): Promise<ReturnType<typeof fastify>> => {
  const app = fastify({
    logger: true,
  });

  app.get('/health', async (): Promise<{ ok: boolean }> => {
    return { ok: true };
  });

  await registerSessionRoutes(app);
  return app;
};

if (require.main === module) {
  buildServer()
    .then((server) => {
      const port = Number(process.env.PORT) || 3001;
      return server.listen({ port, host: '0.0.0.0' });
    })
    .catch((err: Error) => {
      console.error(err);
      process.exit(1);
    });
}

export { buildServer };
