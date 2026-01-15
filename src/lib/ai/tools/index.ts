/**
 * AI tools for document editing.
 */

export {
  DOCUMENT_TOOLS,
  REPLACE_TEXT_TOOL,
  INSERT_TEXT_TOOL,
  DELETE_TEXT_TOOL,
  GET_DOCUMENT_SECTION_TOOL,
} from './definitions';
export { executeTool, type ToolResult } from './executor';
export { chatWithTools, type ChatWithToolsOptions, type ChatWithToolsResult } from './chat-with-tools';
