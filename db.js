/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hostinger MongoDB Atlas Connection Helper
 * Primary database synchronization is also built directly into server.ts
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';

export const client = uri ? new MongoClient(uri) : null;

export async function connectDB() {
  if (!client) return null;
  await client.connect();
  return client.db(process.env.MONGODB_DB_NAME || 'pharmacare_erp');
}
