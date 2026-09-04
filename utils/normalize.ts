import { JSONContent } from '@tiptap/core'

/**
 * Splits paragraphs containing hardBreak nodes into multiple paragraphs.
 */
function splitHardBreaks(content: JSONContent[]): JSONContent[] {
  const newContent: JSONContent[] = [];
  for (const block of content) {
    if (block.type === 'paragraph' && block.content) {
      let currentP: JSONContent = { type: 'paragraph', content: [] };
      for (const node of block.content) {
        if (node.type === 'hardBreak') {
          newContent.push(currentP);
          currentP = { type: 'paragraph', content: [] };
        } else {
          currentP.content?.push(node);
        }
      }
      newContent.push(currentP);
    } else {
      newContent.push(block);
    }
  }
  return newContent;
}

/**
 * Normalizes content by converting hard breaks to paragraphs,
 * so that our DOM-based pagination can cleanly split lines across pages.
 */
export function normalizeContent(content: any): JSONContent | string {
  if (!content) return { type: 'doc', content: [{ type: 'paragraph' }] };

  let parsed: any = content;

  // Handle JSON stringified content
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Leave as string
      }
    }
  }

  // Handle plain HTML / text content
  if (typeof parsed === 'string') {
    let html = parsed.replace(/<br\s*\/?>/gi, '</p><p>');
    return html;
  }

  // Handle CHORDED desktop SavedDocument format with editorContent
  if (parsed && typeof parsed === 'object' && parsed.editorContent) {
    parsed = parsed.editorContent;
  }

  // Handle bare Array of block nodes
  if (Array.isArray(parsed)) {
    return {
      type: 'doc',
      content: splitHardBreaks(parsed),
    };
  }

  // Handle JSONContent object
  if (parsed && typeof parsed === 'object') {
    if (parsed.type === 'doc' && Array.isArray(parsed.content)) {
      return {
        ...parsed,
        content: splitHardBreaks(parsed.content),
      };
    }

    if (Array.isArray(parsed.content)) {
      return {
        type: 'doc',
        content: splitHardBreaks(parsed.content),
      };
    }

    if (parsed.type === 'doc') {
      return {
        ...parsed,
        content: [],
      };
    }

    if (parsed.type) {
      return {
        type: 'doc',
        content: splitHardBreaks([parsed]),
      };
    }
  }

  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
