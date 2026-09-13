import { esClient, EMAILS_INDEX, isElasticReady } from '../config/elastic';
import prisma from '../config/db';
import { EmailSearchQuery } from '../types';

export class ElasticService {
  /**
   * Index or update an email document in Elasticsearch
   */
  public static async indexEmail(emailJob: {
    id: string;
    userId?: string | null;
    senderEmail: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date;
    sentAt?: Date | null;
    createdAt?: Date;
  }): Promise<void> {
    try {
      if (!isElasticReady) return;

      await esClient.index({
        index: EMAILS_INDEX,
        id: emailJob.id,
        body: {
          id: emailJob.id,
          userId: emailJob.userId || '',
          senderEmail: emailJob.senderEmail,
          recipientEmail: emailJob.recipientEmail,
          subject: emailJob.subject,
          body: emailJob.body,
          status: emailJob.status,
          scheduledAt: emailJob.scheduledAt.toISOString(),
          sentAt: emailJob.sentAt ? emailJob.sentAt.toISOString() : null,
          createdAt: emailJob.createdAt ? emailJob.createdAt.toISOString() : new Date().toISOString(),
        },
        refresh: true, // Make immediately searchable
      });
    } catch (err: any) {
      console.warn(`[Elasticsearch] Failed to index email ${emailJob.id}:`, err.message);
    }
  }

  /**
   * Update status and sent timestamp of an indexed email
   */
  public static async updateEmailStatus(
    id: string,
    status: string,
    sentAt?: Date | null
  ): Promise<void> {
    try {
      if (!isElasticReady) return;

      await esClient.update({
        index: EMAILS_INDEX,
        id,
        body: {
          doc: {
            status,
            sentAt: sentAt ? sentAt.toISOString() : null,
          },
        },
        refresh: true,
      });
    } catch (err: any) {
      console.warn(`[Elasticsearch] Failed to update email ${id} status:`, err.message);
    }
  }

  /**
   * Search emails using Elasticsearch with full-text multi-match and filters
   */
  public static async searchEmails(params: EmailSearchQuery) {
    const { query, status, userId, from = 0, size = 50 } = params;

    if (isElasticReady) {
      try {
        const mustClauses: any[] = [];

        if (status) {
          mustClauses.push({ term: { status } });
        }

        if (userId) {
          mustClauses.push({ term: { userId } });
        }

        if (query && query.trim()) {
          mustClauses.push({
            multi_match: {
              query: query.trim(),
              fields: [
                'recipientEmail^3',
                'subject^2',
                'senderEmail',
                'body',
              ],
              fuzziness: 'AUTO',
            },
          });
        }

        const body: any = {
          from,
          size,
          sort: [{ createdAt: { order: 'desc' } }],
        };

        if (mustClauses.length > 0) {
          body.query = { bool: { must: mustClauses } };
        } else {
          body.query = { match_all: {} };
        }

        const response = await esClient.search({
          index: EMAILS_INDEX,
          body,
        });

        const hits = response.hits.hits.map((hit: any) => hit._source);
        const total = typeof response.hits.total === 'number' 
          ? response.hits.total 
          : response.hits.total?.value || hits.length;

        return {
          source: 'elasticsearch',
          total,
          emails: hits,
        };
      } catch (err: any) {
        console.warn('[Elasticsearch] Search query failed, falling back to DB:', err.message);
      }
    }

    // Database Fallback Search
    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (query && query.trim()) {
      const q = query.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { senderEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: size,
      }),
    ]);

    return {
      source: 'database_fallback',
      total,
      emails,
    };
  }
}

export default ElasticService;
