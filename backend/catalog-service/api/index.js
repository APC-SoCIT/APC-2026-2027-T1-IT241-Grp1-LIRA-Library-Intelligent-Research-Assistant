const { createApp } = require('../dist/create-app');

let application;

async function initialize() {
  const app = await createApp();
  try {
    await app.init();
    return app.getHttpAdapter().getInstance();
  } catch (error) {
    await app.close();
    throw error;
  }
}

module.exports = async (request, response) => {
  if (!application) {
    application = initialize().catch((error) => {
      application = undefined;
      throw error;
    });
  }

  const handler = await application;
  if (request.aborted || response.destroyed) return;
  // Keep the invocation active through a slow streamed response, including
  // cancellation. Express's handler returns before its async routes finish.
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      response.removeListener('finish', complete);
      response.removeListener('close', complete);
      response.removeListener('error', fail);
    };
    const complete = () => { cleanup(); resolve(); };
    const fail = (error) => { cleanup(); reject(error); };
    response.once('finish', complete);
    response.once('close', complete);
    response.once('error', fail);
    try { handler(request, response); } catch (error) { fail(error); }
  });
};
