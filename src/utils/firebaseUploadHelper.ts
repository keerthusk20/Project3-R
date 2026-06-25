/**
 * Firebase Storage Upload Helper with Retry Logic
 * Provides robust file upload with exponential backoff and proper error handling
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

export interface UploadOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<UploadOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  onRetry: () => {},
};

/**
 * Determine if a Firebase Storage error is retryable
 * 
 * Non-retryable errors:
 * - 'storage/unauthorized' - Permission denied (auth issue) - but actually CAN be transient!
 * - 'storage/not-found' - Bucket not found
 * - 'storage/object-not-found' - Object not found
 * - 'storage/bucket-not-found' - Bucket doesn't exist
 * - 'storage/invalid-checksum' - File corrupted
 * - 'storage/invalid-argument' - Invalid input
 * 
 * Retryable errors:
 * - 403 Forbidden (can be transient for Firebase uploads)
 * - 408, 429, 500, 502, 503, 504 HTTP codes
 * - Network timeouts
 */
function isRetryableError(error: any): boolean {
  const code = error.code || '';
  const message = error.message || '';
  const status = error.serverResponse?.status;

  // Firebase 403 CAN be transient for uploads - always retry
  if (status === 403) {
    return true;
  }

  // These are truly permanent errors
  const permanentCodes = [
    'storage/not-found',
    'storage/object-not-found',
    'storage/bucket-not-found',
    'storage/invalid-checksum',
    'storage/invalid-argument',
    'storage/invalid-root-uri',
  ];

  if (permanentCodes.includes(code)) {
    return false;
  }

  // Retryable HTTP status codes
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (status && retryableStatuses.includes(status)) {
    return true;
  }

  // Check for network-related messages
  const retryableMessages = [
    'network',
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ERR_NETWORK',
    'aborted',
  ];

  if (retryableMessages.some((msg) => message.toLowerCase().includes(msg))) {
    return true;
  }

  // For unknown errors, default to retryable (safer approach)
  return true;
}

/**
 * Upload a file to Firebase Storage with exponential backoff retry logic
 * 
 * @param filePath - Storage path (e.g., "gst/userId/docId/fieldName_filename.pdf")
 * @param file - File to upload
 * @param options - Upload options (maxRetries, initialDelayMs, onRetry callback)
 * @returns Download URL if successful
 * @throws Error if all retries fail
 * 
 * @example
 * const url = await uploadFileWithRetry('gst/user123/app456/pan_doc.pdf', panFile, {
 *   maxRetries: 3,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.code}`)
 * });
 */
export async function uploadFileWithRetry(
  filePath: string,
  file: File,
  options: UploadOptions = {}
): Promise<string> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(
        `📤 Upload attempt ${attempt}/${config.maxRetries} for: ${file.name}`
      );

      const storageRef = ref(storage, filePath);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
      });

      const downloadUrl = await getDownloadURL(snapshot.ref);

      console.log(
        `✅ Upload successful on attempt ${attempt}/${config.maxRetries}: ${file.name}`
      );

      return downloadUrl;
    } catch (error: any) {
      lastError = error;

      // Log the error details
      console.warn(
        `⚠️ Upload attempt ${attempt}/${config.maxRetries} failed for ${file.name}:`,
        {
          code: error.code,
          message: error.message,
          status: error.serverResponse?.status,
        }
      );

      // Determine if error is retryable
      const retryable = isRetryableError(error);

      if (!retryable) {
        console.error(
          `❌ Non-retryable error for ${file.name}: ${error.code}. Stopping retries.`
        );
        throw error;
      }

      // If this was the last attempt, don't wait - just throw
      if (attempt === config.maxRetries) {
        console.error(
          `❌ Upload failed after ${config.maxRetries} attempts for ${file.name}`
        );
        throw error;
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delayMs = config.initialDelayMs * Math.pow(2, attempt - 1);
      console.log(
        `⏳ Waiting ${delayMs}ms before retry ${attempt + 1}/${config.maxRetries}...`
      );

      // Call retry callback
      config.onRetry(attempt, error);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but just in case
  throw (
    lastError ||
    new Error(`Upload failed for ${file.name}: Unknown error after ${config.maxRetries} attempts`)
  );
}

/**
 * Upload multiple files in parallel with individual retry logic
 * 
 * @param uploads - Array of { path, file } objects
 * @param options - Upload options
 * @returns Map of path -> downloadUrl for successful uploads
 * @throws Error with details if ANY upload fails (all retries exhausted)
 */
export async function uploadMultipleFiles(
  uploads: Array<{ path: string; file: File }>,
  options: UploadOptions = {}
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const errors: Array<{ path: string; error: any }> = [];

  console.log(`📦 Starting parallel upload of ${uploads.length} files...`);

  // Upload all files in parallel
  const uploadPromises = uploads.map(async ({ path, file }) => {
    try {
      const downloadUrl = await uploadFileWithRetry(path, file, options);
      results.set(path, downloadUrl);
      console.log(`✅ Successfully got download URL for ${path}`);
    } catch (error) {
      errors.push({ path, error });
      console.error(
        `❌ Failed to upload ${path}:`,
        (error as any).message || error
      );
    }
  });

  // Wait for all uploads to complete (don't fail fast)
  await Promise.all(uploadPromises);

  // If ANY upload failed, throw an error with all details
  if (errors.length > 0) {
    const errorSummary = errors
      .map((e) => `${e.path}: ${(e.error as any).message || 'Unknown error'}`)
      .join('\n');
    throw new Error(
      `${errors.length} of ${uploads.length} files failed to upload:\n${errorSummary}`
    );
  }

  console.log(`✅ All ${uploads.length} files uploaded successfully`);
  return results;
}
