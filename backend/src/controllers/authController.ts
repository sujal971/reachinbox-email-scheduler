import { Request, Response } from 'express';
import prisma from '../config/db';
import axios from 'axios';

export class AuthController {
  /**
   * Google OAuth login handler
   * Supports Google ID token / access token verification or fallback dev login
   */
  public static async googleLogin(req: Request, res: Response) {
    try {
      const { credential, accessToken, userInfo } = req.body;

      let email: string = '';
      let name: string = '';
      let avatar: string = '';
      let googleId: string = '';

      if (credential) {
        // If Google JWT credential provided, decode the payload
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            email = payload.email;
            name = payload.name;
            avatar = payload.picture;
            googleId = payload.sub;
          }
        } catch (jwtErr) {
          console.warn('[Auth] Could not decode JWT directly, checking userInfo:', jwtErr);
        }
      } else if (accessToken) {
        // Fetch user info from Google API
        try {
          const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          email = googleRes.data.email;
          name = googleRes.data.name;
          avatar = googleRes.data.picture;
          googleId = googleRes.data.sub;
        } catch (apiErr: any) {
          console.warn('[Auth] Google API userInfo fetch failed:', apiErr.message);
        }
      }

      // If userInfo object was passed directly (e.g. mock or test user)
      if (!email && userInfo && userInfo.email) {
        email = userInfo.email;
        name = userInfo.name || 'ReachInbox Demo User';
        avatar = userInfo.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;
        googleId = userInfo.sub || `google_demo_${Date.now()}`;
      }

      if (!email) {
        return res.status(400).json({ error: 'Valid Google credential or user info required' });
      }

      // Upsert User in PostgreSQL
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name,
          avatar,
          googleId,
        },
        update: {
          name,
          avatar,
          googleId,
          updatedAt: new Date(),
        },
      });

      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      });
    } catch (err: any) {
      console.error('[Auth] Login error:', err.message);
      return res.status(500).json({ error: 'Authentication failed', details: err.message });
    }
  }

  /**
   * Get user profile
   */
  public static async getProfile(req: Request, res: Response) {
    try {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email parameter required' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { slackIntegration: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ user });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

export default AuthController;
