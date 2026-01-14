/**
 * Mailpit API helper for E2E tests.
 * Mailpit is a local email server that captures all emails during development.
 * API docs: https://mailpit.axllent.org/docs/api-v1/
 *
 * Note: This file is still named "inbucket.ts" for backwards compatibility,
 * but it now uses the Mailpit API which Supabase uses since v1.x.
 */

const MAILPIT_URL = process.env.INBUCKET_URL || 'http://localhost:54324';

interface MailpitAddress {
  Name: string;
  Address: string;
}

interface MailpitMessageSummary {
  ID: string;
  MessageID: string;
  Read: boolean;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  Created: string;
  Size: number;
  Attachments: number;
  Snippet: string;
}

interface MailpitMessagesResponse {
  total: number;
  unread: number;
  count: number;
  messages: MailpitMessageSummary[];
}

interface MailpitMessage {
  ID: string;
  MessageID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  Date: string;
  Text: string;
  HTML: string;
}

// Compatibility interface for existing code
interface InbucketMessage {
  mailbox: string;
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  body: {
    text: string;
    html: string;
  };
}

interface InbucketHeader {
  mailbox: string;
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  size: number;
}

/**
 * Convert Mailpit message to Inbucket format for compatibility.
 */
function toInbucketMessage(msg: MailpitMessage, email: string): InbucketMessage {
  return {
    mailbox: email.split('@')[0],
    id: msg.ID,
    from: msg.From.Address,
    to: msg.To.map((t) => t.Address),
    subject: msg.Subject,
    date: msg.Date,
    body: {
      text: msg.Text,
      html: msg.HTML,
    },
  };
}

/**
 * Convert Mailpit message summary to Inbucket header format.
 */
function toInbucketHeader(msg: MailpitMessageSummary, email: string): InbucketHeader {
  return {
    mailbox: email.split('@')[0],
    id: msg.ID,
    from: msg.From.Address,
    to: msg.To.map((t) => t.Address),
    subject: msg.Subject,
    date: msg.Created,
    size: msg.Size,
  };
}

/**
 * List all messages for a given email address.
 */
export async function listMessages(email: string): Promise<InbucketHeader[]> {
  // Search for messages sent to this email address
  const searchQuery = encodeURIComponent(`to:${email}`);
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${searchQuery}`);

  if (!response.ok) {
    // If search returns 404, return empty array (no messages)
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to list messages: ${response.status}`);
  }

  const data: MailpitMessagesResponse = await response.json();
  return data.messages.map((m) => toInbucketHeader(m, email));
}

/**
 * Get a specific message by ID.
 */
export async function getMessage(_email: string, messageId: string): Promise<InbucketMessage> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);

  if (!response.ok) {
    throw new Error(`Failed to get message: ${response.status}`);
  }

  const msg: MailpitMessage = await response.json();
  return toInbucketMessage(msg, _email);
}

/**
 * Delete all messages for a specific email address.
 * Since Mailpit doesn't have per-mailbox deletion, we search and delete individually.
 */
export async function clearMailbox(email: string): Promise<void> {
  const messages = await listMessages(email);

  for (const msg of messages) {
    try {
      await fetch(`${MAILPIT_URL}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: [msg.id] }),
      });
    } catch {
      // Ignore deletion errors
    }
  }
}

/**
 * Wait for an email to arrive for the given address.
 * If initialMessageIds is provided, only considers messages not in that set.
 * Otherwise, returns the first message found for this email address.
 */
export async function waitForEmail(
  email: string,
  options: {
    timeout?: number;
    pollInterval?: number;
    subject?: string | RegExp;
    initialMessageIds?: Set<string>;
  } = {}
): Promise<InbucketMessage> {
  const { timeout = 30000, pollInterval = 500, subject, initialMessageIds } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messages = await listMessages(email);

    // Filter to only consider messages we haven't seen before
    const candidates = initialMessageIds ? messages.filter((m) => !initialMessageIds.has(m.id)) : messages;

    if (candidates.length > 0) {
      // Get the most recent candidate message
      const latestHeader = candidates[candidates.length - 1];

      // If subject filter is provided, check it
      if (subject) {
        const matches =
          typeof subject === 'string' ? latestHeader.subject.includes(subject) : subject.test(latestHeader.subject);

        if (!matches) {
          // Wait for another email
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          continue;
        }
      }

      // Fetch full message
      return getMessage(email, latestHeader.id);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Timeout waiting for email to ${email} (waited ${timeout}ms)`);
}

/**
 * Extract magic link URL from email body.
 * Supabase magic links contain a token parameter.
 * Automatically rewrites 127.0.0.1 to localhost for compatibility.
 */
export function extractMagicLink(message: InbucketMessage): string {
  // Try HTML body first, then text body
  const body = message.body.html || message.body.text;

  // Supabase magic link patterns:
  // - /auth/v1/verify?token=...&type=magiclink&redirect_to=...
  // - /auth/callback?token=...
  // The email usually contains a full URL with the app's redirect

  let link: string | null = null;

  // Look for href in HTML
  const hrefMatch = body.match(/href=["']([^"']*(?:token|code)[^"']*)["']/i);
  if (hrefMatch) {
    link = decodeHtmlEntities(hrefMatch[1]);
  }

  // Look for URL in text (starts with http)
  if (!link) {
    const urlMatch = body.match(/(https?:\/\/[^\s<>"]+(?:token|code)[^\s<>"]*)/i);
    if (urlMatch) {
      link = urlMatch[1];
    }
  }

  // Look for any http URL as fallback
  if (!link) {
    const anyUrlMatch = body.match(/(https?:\/\/[^\s<>"]+)/);
    if (anyUrlMatch) {
      link = anyUrlMatch[1];
    }
  }

  if (!link) {
    throw new Error(`Could not find magic link in email body:\n${body.substring(0, 500)}`);
  }

  // Rewrite 127.0.0.1 to localhost for Docker network compatibility
  // Supabase might listen on localhost but email contains 127.0.0.1
  const testPort = process.env.PORT || '3088';
  return link
    .replace(/127\.0\.0\.1:54321/g, 'localhost:54321')
    .replace(/redirect_to=http%3A%2F%2F127\.0\.0\.1%3A3000/g, `redirect_to=http%3A%2F%2Flocalhost%3A${testPort}`)
    .replace(/redirect_to=http:\/\/127\.0\.0\.1:3000/g, `redirect_to=http://localhost:${testPort}`);
}

/**
 * Decode HTML entities in a string.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Complete magic link login flow.
 * 1. Clears mailbox
 * 2. Submits login form
 * 3. Waits for email
 * 4. Extracts and returns magic link
 */
export async function getMagicLinkForEmail(email: string): Promise<string> {
  const message = await waitForEmail(email, {
    subject: /magic link|sign in|log in/i,
    timeout: 30000,
  });

  return extractMagicLink(message);
}
