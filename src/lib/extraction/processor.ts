import { createClient } from '@/lib/supabase/server';
import { getVaultItem, updateVaultItemStatus } from '@/lib/api/vault';
import { extractPdfText } from '@/lib/extraction/pdf';
import { extractDocxText } from '@/lib/extraction/docx';
import { extractTextContent } from '@/lib/extraction/text';
import { chunkText } from '@/lib/extraction/chunker';
import { getEmbeddings } from '@/lib/extraction/embeddings';
import { vaultLogger } from '@/lib/logger';
import { VAULT_STORAGE_BUCKET } from '@/lib/vault/constants';
import type { ExtractionResult } from './pdf';
import type { Chunk } from './chunker';

/**
 * Minimum text length to consider extraction successful.
 * Text shorter than this is considered 'partial' extraction.
 */
const MIN_TEXT_LENGTH = 10;

/**
 * Result of the extraction process.
 */
export interface ProcessExtractionResult {
  success: boolean;
  itemId: string;
  status: 'success' | 'partial' | 'failed';
  chunkCount?: number;
  error?: string;
}

/**
 * Downloads a file from Supabase storage.
 *
 * @param storagePath - The path to the file in storage
 * @returns The file contents as a Buffer
 */
async function downloadFile(storagePath: string): Promise<Buffer> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from(VAULT_STORAGE_BUCKET).download(storagePath);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Selects the appropriate extractor based on file type.
 *
 * @param fileType - The type of file (pdf, docx, txt)
 * @param buffer - The file contents as a Buffer
 * @returns ExtractionResult from the appropriate extractor
 */
async function extractByType(fileType: string, buffer: Buffer): Promise<ExtractionResult> {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return extractPdfText(buffer);
    case 'docx':
      return extractDocxText(buffer);
    case 'txt':
    case 'text':
      return extractTextContent(buffer);
    default:
      return {
        text: '',
        success: false,
        error: `Unsupported file type: ${fileType}`,
      };
  }
}

/**
 * Inserts chunks with embeddings into the vault_chunks table.
 *
 * @param vaultItemId - The ID of the vault item
 * @param chunks - Array of chunks with content and index
 * @param embeddings - Array of embedding vectors
 */
async function insertChunks(vaultItemId: string, chunks: Chunk[], embeddings: number[][]): Promise<void> {
  const supabase = await createClient();

  const chunkRecords = chunks.map((chunk, i) => ({
    vault_item_id: vaultItemId,
    content: chunk.content,
    chunk_index: chunk.index,
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error } = await supabase.from('vault_chunks').insert(chunkRecords).select();

  if (error) {
    throw new Error(`Failed to insert chunks: ${error.message}`);
  }
}

/**
 * Processes a vault item through the full extraction pipeline:
 * 1. Download file from storage
 * 2. Extract text based on file type
 * 3. Chunk text into segments
 * 4. Generate embeddings for each chunk
 * 5. Store chunks with embeddings
 *
 * Status progression: pending -> downloading -> extracting -> chunking -> embedding -> success/partial/failed
 *
 * @param vaultItemId - The ID of the vault item to process
 * @returns ProcessExtractionResult with status and details
 */
export async function processExtraction(vaultItemId: string): Promise<ProcessExtractionResult> {
  const log = vaultLogger({ itemId: vaultItemId });

  try {
    // Step 1: Get vault item from database
    const item = await getVaultItem(vaultItemId);
    log.info({ filename: item.filename, type: item.type }, 'Starting extraction process');

    // Step 2: Update status to 'downloading' and download file
    await updateVaultItemStatus(vaultItemId, 'downloading');

    let buffer: Buffer;
    try {
      buffer = await downloadFile(item.storage_path || '');
    } catch (downloadError) {
      const errorMessage = downloadError instanceof Error ? downloadError.message : 'Download failed';
      log.error({ error: errorMessage }, 'Failed to download file');
      await updateVaultItemStatus(vaultItemId, 'failed', { error: errorMessage });
      return {
        success: false,
        itemId: vaultItemId,
        status: 'failed',
        error: errorMessage,
      };
    }

    // Step 3: Update status to 'extracting' and extract text
    await updateVaultItemStatus(vaultItemId, 'extracting');

    const extractionResult = await extractByType(item.type, buffer);

    // Check for extraction failure
    if (!extractionResult.success || !extractionResult.text) {
      const errorMessage = extractionResult.error || 'Extraction returned no text';
      log.warn({ error: errorMessage }, 'Extraction failed');
      await updateVaultItemStatus(vaultItemId, 'failed', { error: errorMessage });
      return {
        success: false,
        itemId: vaultItemId,
        status: 'failed',
        error: errorMessage,
      };
    }

    const { text } = extractionResult;

    // Check for minimal content
    if (text.length < MIN_TEXT_LENGTH) {
      log.warn({ textLength: text.length }, 'Extraction returned minimal content');
      await updateVaultItemStatus(vaultItemId, 'partial', {
        extractedText: text,
        error: 'Minimal content extracted',
      });
      return {
        success: true,
        itemId: vaultItemId,
        status: 'partial',
        chunkCount: 0,
      };
    }

    // Step 4: Update status to 'chunking' and create chunks
    await updateVaultItemStatus(vaultItemId, 'chunking');

    const chunks = chunkText(text);

    // Check for no chunks
    if (chunks.length === 0) {
      log.warn('Chunking produced no chunks');
      await updateVaultItemStatus(vaultItemId, 'partial', {
        extractedText: text,
        error: 'No chunks generated',
      });
      return {
        success: true,
        itemId: vaultItemId,
        status: 'partial',
        chunkCount: 0,
      };
    }

    // Step 5: Update status to 'embedding' and generate embeddings
    await updateVaultItemStatus(vaultItemId, 'embedding');

    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await getEmbeddings(chunkContents);

    // Step 6: Insert chunks with embeddings into database
    await insertChunks(vaultItemId, chunks, embeddings);

    // Step 7: Update status to 'success' with chunk count
    await updateVaultItemStatus(vaultItemId, 'success', {
      extractedText: text,
      chunkCount: chunks.length,
    });

    log.info({ chunkCount: chunks.length }, 'Extraction completed successfully');

    return {
      success: true,
      itemId: vaultItemId,
      status: 'success',
      chunkCount: chunks.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ error: errorMessage }, 'Extraction process failed');

    try {
      await updateVaultItemStatus(vaultItemId, 'failed', { error: errorMessage });
    } catch {
      // Ignore status update failure
    }

    return {
      success: false,
      itemId: vaultItemId,
      status: 'failed',
      error: errorMessage,
    };
  }
}
