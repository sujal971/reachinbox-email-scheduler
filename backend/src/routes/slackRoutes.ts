import { Router } from 'express';
import SlackController from '../controllers/slackController';

const router = Router();

router.get('/auth-url', SlackController.getAuthUrl);
router.get('/callback', SlackController.oauthCallback);
router.post('/webhook', SlackController.connectWebhook);
router.get('/status', SlackController.getStatus);
router.post('/disconnect', SlackController.disconnect);
router.post('/test-alert', SlackController.sendTestAlert);

export default router;
