import app from './app';
import { envVeriables } from './config/envConfig';
import { startApplicationWorker } from './workers/applicationWorker';

async function main() {
  try {
    // Start background workers
    startApplicationWorker();

    app.listen(envVeriables.PORT, () => {
      console.log(`Swenker Server is running on port ${envVeriables.PORT}`);
    });
  } catch (err) {
    console.log(err);
  }
}

main();
