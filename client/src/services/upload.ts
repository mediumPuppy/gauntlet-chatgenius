export async function getPresignedUrl(fileType: string, token: string) {
  const response = await fetch("/api/upload/presigned-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fileType }),
  });

  if (!response.ok) {
    throw new Error("Failed to get presigned URL");
  }

  return response.json();
}
