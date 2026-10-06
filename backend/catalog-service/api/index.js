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
  handler(request, response);
};
