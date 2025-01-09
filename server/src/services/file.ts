import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../config/s3';
import 'multer';

export class FileService {
  static async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    const key = `uploads/${userId}/${Date.now()}-${file.originalname}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read' // Makes the file publicly accessible
    }));

    return key;
  }

  static async deleteFile(key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
  }

  static getPublicUrl(key: string): string {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
} 