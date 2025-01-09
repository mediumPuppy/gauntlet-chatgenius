import { useState } from 'react';
import { getPresignedUrl } from '../services/upload';
import { useAuth } from '../contexts/AuthContext';

export default function FileUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const { token } = useAuth(); // Adjust this if your auth context or access token management differs

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setStatus('Uploading...');

    try {
      // 1. Request presigned URL
      const { uploadUrl, key } = await getPresignedUrl(file.type, token);

      // 2. Upload file directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // 3. (Optional) You could send the key or related metadata back to your server here

      setStatus(`File uploaded successfully! S3 Key: ${key}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Error uploading file');
    }
  };

  return (
    <div className="p-4">
      <h1>File Upload</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file}>
        Upload
      </button>
      {status && <p>{status}</p>}
    </div>
  );
} 