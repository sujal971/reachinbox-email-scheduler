import axios from 'axios';
import prisma from '../config/db';
import { redisConnection } from '../config/redis';

export class SlackService {
  /**
   * Generates Slack OAuth authorization URL
   */
  public static getAuthorizationUrl(userId: string): string {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback');
    const scope = encodeURIComponent('incoming-webhook,chat:write');
    const state = userId || 'default-user';

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
  }

  /**
   * Exchanges OAuth code for Slack access token and incoming webhook
   */
  public static async handleOAuthCallback(code: string, userId: string) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback';

    if (!clientId || !clientSecret) {
      throw new Error('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET is missing in environment variables.');
    }

    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    const webhookUrl = data.incoming_webhook?.url;
    const channel = data.incoming_webhook?.channel;
    const teamName = data.team?.name;
    const teamId = data.team?.id;
    const accessToken = data.access_token;

    // Ensure user exists before creating integration
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@reachinbox.ai`,
        name: 'ReachInbox User',
      },
      update: {},
    });

    // Persist in database for the user
    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      create: {
        userId,
        accessToken,
        incomingWebhookUrl: webhookUrl,
        channel,
        teamName,
        teamId,
        isActive: true,
      },
      update: {
        accessToken,
        incomingWebhookUrl: webhookUrl,
        channel,
        teamName,
        teamId,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Send instant welcome / test message to verify the connection
    if (webhookUrl) {
      await this.postToWebhook(webhookUrl, {
        text: `🎉 *ReachInbox Connected Successfully!*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎉 *ReachInbox Email Scheduler Connected!* \nYour Slack workspace is now connected to receive real-time rate limit alerts and scheduling notifications.`,
            },
          },
        ],
      });
    }

    return integration;
  }

  /**
   * Connects via direct incoming webhook URL
   */
  public static async connectWebhook(userId: string, webhookUrl: string, channelName?: string) {
    // Ensure user exists before creating integration
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@reachinbox.ai`,
        name: 'ReachInbox User',
      },
      update: {},
    });

    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      create: {
        userId,
        incomingWebhookUrl: webhookUrl,
        channel: channelName || '#general',
        teamName: 'ReachInbox Slack',
        isActive: true,
      },
      update: {
        incomingWebhookUrl: webhookUrl,
        channel: channelName || '#general',
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Send verification ping
    await this.postToWebhook(webhookUrl, {
      text: `🎉 *ReachInbox Connected!* \nWebhook successfully verified. Rate limit alerts will be posted here.`,
    });

    return integration;
  }

  /**
   * Disconnects Slack integration
   */
  public static async disconnect(userId: string) {
    return prisma.slackIntegration.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  /**
   * Gets current Slack integration status
   */
  public static async getStatus(userId: string) {
    const integration = await prisma.slackIntegration.findFirst({
      where: { userId, isActive: true },
    });
    return {
      connected: !!integration,
      channel: integration?.channel || null,
      teamName: integration?.teamName || null,
      connectedAt: integration?.connectedAt || null,
    };
  }

  /**
   * Helper to send message payload to Slack Webhook
   */
  private static async postToWebhook(url: string, payload: any): Promise<boolean> {
    try {
      const res = await axios.post(url, payload, { timeout: 5000 });
      return res.status === 200;
    } catch (err: any) {
      console.error('[Slack] Error posting to webhook:', err.response?.data || err.message);
      return false;
    }
  }

  /**
   * Sends a live Slack notification when a sender hits their hourly limit
   */
  public static async notifyRateLimitHit(params: {
    senderEmail: string;
    hourlyLimit: number;
    currentCount: number;
    nextAvailableWindowTime: Date;
    userId?: string;
  }): Promise<boolean> {
    const { senderEmail, hourlyLimit, currentCount, nextAvailableWindowTime, userId } = params;

    // 1. Check if user (or any tenant) has an active Slack integration
    let integration = null;
    if (userId) {
      integration = await prisma.slackIntegration.findFirst({
        where: { userId, isActive: true },
      });
    }

    if (!integration) {
      // Fallback to any active integration in the system
      integration = await prisma.slackIntegration.findFirst({
        where: { isActive: true },
      });
    }

    if (!integration || !integration.incomingWebhookUrl) {
      // Not connected: gracefully skip without throwing/crashing
      console.log(`[Slack] Sender ${senderEmail} hit rate limit, but Slack is not connected. Skipping notification.`);
      return false;
    }

    // 2. Debounce to prevent flooding Slack when 1000+ jobs hit rate limit simultaneously
    const hourKey = new Date().toISOString().slice(0, 13);
    const debounceKey = `slack_alert_debounce:${senderEmail}:${hourKey}`;
    const alreadyNotified = await redisConnection.get(debounceKey);

    if (alreadyNotified) {
      console.log(`[Slack] Alert already dispatched this hour for ${senderEmail}. Debouncing.`);
      return true;
    }

    // Set debounce for 15 minutes
    await redisConnection.set(debounceKey, 'true', 'EX', 900);

    const formattedNextWindow = nextAvailableWindowTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const payload = {
      text: `🚨 *ReachInbox Rate Limit Alert*: Sender ${senderEmail} reached hourly limit (${hourlyLimit}/hr).`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 ReachInbox Rate Limit Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n*${hourlyLimit} emails/hr*`,
            },
            {
              type: 'mrkdwn',
              text: `*Current Quota Used:*\n${currentCount} / ${hourlyLimit}`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Available Window:*\n~${formattedNextWindow}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Action Taken*: Subsequent jobs have been safely delayed and rescheduled into the next hour window without dropping or failing.`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Email Job Scheduler • ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const success = await this.postToWebhook(integration.incomingWebhookUrl, payload);
    if (success) {
      console.log(`[Slack] Successfully sent live rate-limit alert for sender: ${senderEmail}`);
    }
    return success;
  }
}

export default SlackService;
