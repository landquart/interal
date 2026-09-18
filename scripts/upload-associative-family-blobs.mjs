import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { put } from '@vercel/blob';

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is required');

for (const [file, pathname] of [
  [process.argv[2], 'associative-family/v4/metadata.zip'],
  [process.argv[3], 'associative-family/v4/members.zip']
]) {
  if (!file) throw new Error('Both metadata and members ZIP paths are required');
  const info = await stat(file);
  console.log(`Uploading ${pathname} (${info.size} bytes)`);
  const result = await put(pathname, createReadStream(file), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, multipart: true, token
  });
  console.log(`${pathname}: ${result.url}`);
}
