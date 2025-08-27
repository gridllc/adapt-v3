import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import slugify from "slugify";

export const s3 = new S3Client({ 
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

export const BUCKET = process.env.AWS_BUCKET_NAME!;

/**
 * Generate safe S3 key with user isolation
 */
function safeKey({ userId, moduleId, filename }: { userId?: string|null; moduleId: string; filename: string }) {
  const dot = filename.lastIndexOf(".");
  const base = dot === -1 ? filename : filename.slice(0, dot);
  const ext  = dot === -1 ? ""       : filename.slice(dot); // keep .mp4
  const safe = slugify(base, { lower: true, strict: true }); // no spaces
  return `videos/${userId ?? "anon"}/${moduleId}/${safe}${ext}`;
}

/**
 * Generate presigned PUT URL for direct S3 upload
 */
export async function generatePresignedUrl(
  filename: string, 
  contentType: string,
  moduleId: string,
  userId?: string | null
) {
  const Key = safeKey({ userId, moduleId, filename });
  
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key,
    ContentType: contentType,    // IMPORTANT: sign with EXACT contentType
    ACL: "private",
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 }); // 10 min

  return { url, key: Key, moduleId };
}

/**
 * Generate presigned GET URL for video playback
 */
export async function generatePlaybackUrl(key: string) {
  const getUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 60 * 30 } // 30 min
  );
  return getUrl;
}
