import app from './app';
import { envVeriables } from './config/envConfig';
import { startApplicationWorker } from './workers/applicationWorker';
import { startNotificationWorker } from './workers/notificationWorker';
import { TrainerPayoutService } from './modules/trainerPayout/trainerPayout.service';

async function main() {
  try {
    // Start background workers
    startApplicationWorker();
    startNotificationWorker();

    // Run due trainer payouts generation on startup and every hour
    TrainerPayoutService.generateDueTrainerPayouts().catch((e) =>
      console.error('Initial trainer payouts generation error:', e)
    );
    setInterval(() => {
      TrainerPayoutService.generateDueTrainerPayouts().catch((e) =>
        console.error('Periodic trainer payouts generation error:', e)
      );
    }, 1000 * 60 * 60);

    app.listen(envVeriables.PORT, () => {
      console.log(`Gym Management Server is running on port ${envVeriables.PORT}`);
    });
  } catch (err) {
    console.log(err);
  }
}

main();
