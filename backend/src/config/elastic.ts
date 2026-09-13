import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const esNode = process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9200';

export const esClient = new Client({
  node: esNode,
  requestTimeout: 4000,
  maxRetries: 2,
});

export const EMAILS_INDEX = 'emails';

export let isElasticReady = false;

export async function initElasticsearch(): Promise<boolean> {
  try {
    const health = await esClient.ping();
    if (health) {
      console.log(`[Elasticsearch] Connected successfully to ${esNode}`);
      isElasticReady = true;

      // Check if emails index exists, if not create it
      const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
      if (!indexExists) {
        await esClient.indices.create({
          index: EMAILS_INDEX,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' },
                senderEmail: { type: 'keyword' },
                recipientEmail: { type: 'keyword' },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        console.log(`[Elasticsearch] Created index '${EMAILS_INDEX}' with mappings.`);
      }
      return true;
    }
  } catch (err: any) {
    console.warn(`[Elasticsearch] Service not currently available at ${esNode}: ${err.message}. Search will use DB fallback.`);
    isElasticReady = false;
  }
  return false;
}

export default esClient;
