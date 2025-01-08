import express from 'express';
import multer from 'multer';
import { PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET } from '../config/s3';
import { authenticateToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const upload = multer();

router.get('/test', async (req, res) => {
  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    res.json({
      message: 'S3 connection successful',
      buckets: response.Buckets
    });
  } catch (error) {
    console.error('S3 test error:', error);
    res.status(500).json({ error: 'Failed to connect to S3' });
  }
});

router.post('/presigned-url', authenticateToken, async (req, res) => {
  try {
    const fileType = req.body.fileType;
    const key = `uploads/${uuidv4()}-${Date.now()}${fileType}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: fileType
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({
      uploadUrl: signedUrl,
      key: key
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

export default router; 