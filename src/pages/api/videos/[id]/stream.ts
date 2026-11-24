import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { APIRoute } from 'astro';
import { getFullVideoById } from '../../../../lib/queries';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'videos');

export const GET: APIRoute = async ({ params, locals, request }) => {
  const id = params.id ?? '';
  const video = await getFullVideoById(id);

  if (!video) {
    return new Response('Video not found', { status: 404 });
  }

  // Server-side premium access enforcement
  if (video.isPremiumOnly && !locals.user?.isPremium && !locals.user?.isAdmin) {
    return new Response('Premium subscription required', { status: 403 });
  }

  // Prevent path traversal by forcing basename and checking resolved prefix
  const safeName = path.basename(video.videoFilename);
  const filePath = path.resolve(STORAGE_DIR, safeName);
  if (!filePath.startsWith(STORAGE_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response('Media file missing', { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get('range');
  const cacheControl = video.isPremiumOnly
    ? 'private, no-store'
    : 'public, max-age=3600';

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new Response('Invalid Range', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const end = match[2]
      ? Math.min(Number.parseInt(match[2], 10), fileSize - 1)
      : fileSize - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      start >= fileSize ||
      end < start
    ) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = fs.createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
        'Cache-Control': cacheControl,
      },
    });
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Content-Type': 'video/mp4',
      'Cache-Control': cacheControl,
    },
  });
};
