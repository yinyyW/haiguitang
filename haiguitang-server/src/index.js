const fastify = require('fastify');

const buildServer = () => {
  const app = fastify({
    logger: true,
  });

  app.get('/health', async () => {
    return { ok: true };
  });

  return app;
};

if (require.main === module) {
  const server = buildServer();

  const port = process.env.PORT || 3001;

  server
    .listen({ port, host: '0.0.0.0' })
    .catch((err) => {
      server.log.error(err);
      process.exit(1);
    });
}

module.exports = {
  buildServer,
};

