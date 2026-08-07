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
export function normalizeContent(content: string | JSONContent | null | undefined): JSONContent | string {
  if (!content) return '<p></p>'

  if (typeof content === 'string') {
    // Replace <br> with </p><p> to convert them into separate block elements
    // This allows the pagination logic to push individual lines to the next page.
    let html = content.replace(/<br\s*\/?>/gi, '</p><p>');
    return html;
  }

  // Handle JSONContent
  if (content.type === 'doc' && content.content) {
    return {
      ...content,
      content: splitHardBreaks(content.content)
    }
  }

  return content
}
