/**
 * Securely downloads a file from an authenticated endpoint
 * @param {string} apiPath - The relative API path (e.g., '/reports/tasks')
 * @param {string} filename - The default filename for the saved file
 */
export async function downloadAuthenticatedFile(apiPath, filename) {
  const token = localStorage.getItem("token");
  
  // Use the full URL if needed, or stick to the relative /api prefix
  const url = apiPath.startsWith('http') ? apiPath : `/api${apiPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
