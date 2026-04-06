/**
 * Unified storage layer:
 * - Production (Vercel): uses @vercel/blob
 * - Local development: saves to public/ folder
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const IS_VERCEL = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveImage(buffer: Buffer, ext = 'jpg'): Promise<string> {
  const fileName = `${uuidv4()}.${ext}`;

  if (IS_VERCEL) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`carousel/${fileName}`, buffer, {
      access: 'public',
      contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png',
    });
    return blob.url;
  }

  // Local: save to public/generated/
  const dir = path.join(process.cwd(), 'public', 'generated');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/generated/${fileName}`;
}

export async function saveUpload(buffer: Buffer, prefix = 'upload', ext = 'jpg'): Promise<string> {
  const fileName = `${prefix}_${uuidv4()}.${ext}`;

  if (IS_VERCEL) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${fileName}`, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
}

export function getPublicUrl(localPath: string): string {
  if (localPath.startsWith('http')) return localPath;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}${localPath}`;
}
