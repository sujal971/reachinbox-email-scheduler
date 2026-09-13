import { Request, Response } from 'express';
import SlackService from '../services/slackService';

export class SlackController {
  /**
   * Redirects user to Slack OAuth authorization page
   */
  public static getAuthUrl(req: Request, res: Response) {
    const userId = (req.query.userId as string) || 'default-user';
    const clientId = process.env.SLACK_CLIENT_ID;

    if (!clientId) {
      return res.status(400).json({
        error: 'SLACK_CLIENT_ID is not configured. You can use direct Webhook connection below.',
      });
    }

    const authUrl = SlackService.getAuthorizationUrl(userId);
    return res.json({ authUrl });
  }

  /**
   * Slack OAuth callback handler
   */
  public static async oauthCallback(req: Request, res: Response) {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=error&msg=${encodeURIComponent(String(error))}`);
      }

      if (!code || typeof code !== 'string') {
        return res.status(400).send('Authorization code missing');
      }

      const userId = (state as string) || 'default-user';
      await SlackService.handleOAuthCallback(code, userId);

      // Redirect back to frontend dashboard with success banner
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=connected`);
    } catch (err: any) {
      console.error('[SlackController] OAuth callback error:', err.message);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?slack=error&msg=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * Direct Webhook connection (allows instant live testing and verification)
   */
  public static async connectWebhook(req: Request, res: Response) {
    try {
      const { webhookUrl, channel, userId = 'default-user' } = req.body;

      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        return res.status(400).json({ error: 'Valid Slack incoming webhook URL is required.' });
      }

      const integration = await SlackService.connectWebhook(userId, webhookUrl, channel);
      return res.json({ message: 'Slack connected successfully via webhook', integration });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get current connection status
   */
  public static async getStatus(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || 'default-user';
      const status = await SlackService.getStatus(userId);
      return res.json(status);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Disconnect Slack
   */
  public static async disconnect(req: Request, res: Response) {
    try {
      const userId = (req.body.userId as string) || 'default-user';
      await SlackService.disconnect(userId);
      return res.json({ message: 'Slack disconnected successfully' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Send live test alert to verify the Slack channel
   */
  public static async sendTestAlert(req: Request, res: Response) {
    try {
      const { senderEmail = 'alex@outboxlabs.io', limit = 50, userId } = req.body;
      const nextWindow = new Date(Date.now() + 3600 * 1000);

      const notified = await SlackService.notifyRateLimitHit({
        senderEmail,
        hourlyLimit: limit,
        currentCount: limit + 1,
        nextAvailableWindowTime: nextWindow,
        userId,
      });

      return res.json({
        success: notified,
        message: notified
          ? 'Live Slack rate-limit alert sent successfully!'
          : 'Slack is not connected or alert was debounced.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

export default SlackController;
