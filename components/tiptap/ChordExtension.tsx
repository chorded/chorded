/**
 * ChordExtension.tsx
 * ──────────────────
 * Custom TipTap inline Node for rendering chords above lyrics.
 *
 * The chord label appears ABOVE the line via CSS absolute positioning.
 * Each paragraph in the editor has `padding-top: 1.9em` to create space.
 *
 * Custom commands:
 *   editor.commands.insertChord(chord: string)
 *   editor.commands.transposeAllChords(semitones: number)
 */

import React, { useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state'
import {
  transposeChord,
  isChordOnlyLine,
  parseChordLine,
  hasInlineBracketedChords,
  parseInlineBracketedLine,
  chordToNashville
} from '../../utils/transposer'
import { useLiveViewer } from './LiveViewerContext'

// ── TypeScript: augment Commands interface ──

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chord: {
      /** Insert a chord node at the current cursor position */
      insertChord: (chord: string) => ReturnType
      /** Transpose every chord node in the document by semitones */
      transposeAllChords: (semitones: number) => ReturnType
      /** Find the next chord matching the given string and select it */
      findNextChord: (chord: string) => ReturnType
      /** Replace the currently selected chord if it matches */
      replaceCurrentChord: (find: string, replace: string) => ReturnType
      /** Replace all occurrences of a specific chord */
      replaceAllChords: (find: string, replace: string) => ReturnType
    }
  }
}

// ── Drag & Drop Helpers for Chord Nodes ──

export interface DropTarget {
  pos: number
  appendSpaces?: number
  rect: { left: number; top: number; height: number }
}

function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right)
  const dy = Math.max(rect.top - y, 0, y - rect.bottom)
  return Math.hypot(dx, dy)
}

function createDragGhost(chordText: string): HTMLElement {
  const ghost = document.createElement('div')
  ghost.className = 'chord-drag-ghost'
  ghost.innerHTML = `<span>${chordText}</span>`
  ghost.style.position = 'fixed'
  ghost.style.pointerEvents = 'none'
  ghost.style.zIndex = '99999'
  return ghost
}

function createDropIndicator(): HTMLElement {
  const indicator = document.createElement('div')
  indicator.className = 'chord-drop-indicator'
  indicator.innerHTML = '<div class="chord-drop-caret-head"></div>'
  indicator.style.position = 'fixed'
  indicator.style.pointerEvents = 'none'
  indicator.style.zIndex = '99998'
  indicator.style.display = 'none'
  return indicator
}

export function computeDropTarget(
  editor: any,
  clientX: number,
  clientY: number
): DropTarget | null {
  if (!editor || editor.isDestroyed) return null
  const view = editor.view
  if (!view || !view.dom) return null

  const dom = view.dom
  const paragraphs = Array.from(dom.querySelectorAll('p')) as HTMLElement[]
  if (paragraphs.length === 0) return null

  // 1. Find nearest paragraph element using 2D distance
  let targetP = paragraphs[0]
  let minDistance = Infinity

  for (const p of paragraphs) {
    const rect = p.getBoundingClientRect()
    const dist = distanceToRect(clientX, clientY, rect)
    if (dist < minDistance) {
      minDistance = dist
      targetP = p
    }
  }

  const pRect = targetP.getBoundingClientRect()

  // 2. Resolve ProseMirror document position for targetP
  let pStartPos: number
  try {
    pStartPos = view.posAtDOM(targetP, 0)
  } catch {
    return null
  }

  const doc = view.state.doc
  if (pStartPos < 0 || pStartPos > doc.content.size) return null

  const $startPos = doc.resolve(pStartPos)
  const pEndPos = $startPos.end($startPos.depth)
  const pContentStart = $startPos.start($startPos.depth)

  // 3. Measure text end position in targetP
  let endCoords: { left: number; right: number; top: number; bottom: number } | null = null
  try {
    endCoords = view.coordsAtPos(pEndPos)
  } catch {
    endCoords = null
  }

  const avgCharWidth = 7.8 // standard average width per char in editor

  // 4. Check if clientX extends beyond the end of text line in paragraph
  if (endCoords && clientX > endCoords.left + avgCharWidth / 2) {
    const extraDist = clientX - endCoords.left
    const appendSpaces = Math.max(1, Math.round(extraDist / avgCharWidth))
    const indicatorLeft = endCoords.left + appendSpaces * avgCharWidth
    const indicatorTop = endCoords.top
    const indicatorHeight = Math.max(endCoords.bottom - endCoords.top, 18)

    return {
      pos: pEndPos,
      appendSpaces,
      rect: {
        left: indicatorLeft,
        top: indicatorTop,
        height: indicatorHeight
      }
    }
  }

  // 5. Compute posAtCoords near the text line level (bottom of paragraph)
  const textLineY = Math.min(clientY, pRect.bottom - 8)
  const clampedX = Math.max(pRect.left + 2, Math.min(clientX, pRect.right - 2))
  const coordsResult = view.posAtCoords({ left: clampedX, top: textLineY })

  let targetPos = pContentStart
  if (coordsResult && coordsResult.pos >= pContentStart && coordsResult.pos <= pEndPos) {
    targetPos = coordsResult.pos
  } else if (endCoords && clientX >= endCoords.left) {
    targetPos = pEndPos
  } else {
    // Find character position in paragraph closest to clientX
    let closestPos = pContentStart
    let minXDist = Infinity
    for (let pos = pContentStart; pos <= pEndPos; pos++) {
      try {
        const c = view.coordsAtPos(pos)
        const d = Math.abs(clientX - c.left)
        if (d < minXDist) {
          minXDist = d
          closestPos = pos
        }
      } catch {
        // ignore
      }
    }
    targetPos = closestPos
  }

  // 6. Get screen coordinates for targetPos indicator line
  try {
    const c = view.coordsAtPos(targetPos)
    return {
      pos: targetPos,
      rect: {
        left: c.left,
        top: c.top,
        height: Math.max(c.bottom - c.top, 18)
      }
    }
  } catch {
    return {
      pos: targetPos,
      rect: {
        left: clientX,
        top: pRect.top,
        height: 18
      }
    }
  }
}

export function executeChordMove(
  editor: any,
  fromPos: number,
  target: DropTarget,
  chordText: string
) {
  if (!editor || editor.isDestroyed) return
  const { view, state } = editor
  const tr = state.tr

  if (fromPos < 0 || fromPos >= state.doc.content.size) return

  // 1. Delete original chord node (atom node size is 1)
  tr.delete(fromPos, fromPos + 1)

  // 2. Map target position through deletion
  let targetPos = tr.mapping.map(target.pos)

  // 3. Append spaces if needed
  if (target.appendSpaces && target.appendSpaces > 0) {
    const spaces = ' '.repeat(target.appendSpaces)
    tr.insertText(spaces, targetPos)
    targetPos += spaces.length
  }

  // 4. Create and insert new chord node
  const chordNode = state.schema.nodes.chord.create({ chord: chordText })
  tr.insert(targetPos, chordNode)

  // 5. Dispatch transaction atomically
  view.dispatch(tr)
  view.focus()

  // 6. Resolve overlaps immediately
  requestAnimationFrame(() => {
    resolveChordOverlaps(view.dom)
  })
}

// ── React NodeView ──

const ChordNodeView: React.FC<NodeViewProps> = ({
  node,
  selected,
  deleteNode,
  updateAttributes,
  getPos,
  editor
}) => {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.attrs.chord as string)
  const [isDraggingThis, setIsDraggingThis] = useState(false)
  const wasDraggingRef = React.useRef(false)
  const { nashville, songKey } = useLiveViewer()

  const displayChord = nashville ? chordToNashville(node.attrs.chord as string, songKey) : (node.attrs.chord as string)

  const handleMouseDown = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (e.button !== 0 || editing) return

    const startX = e.clientX
    const startY = e.clientY
    wasDraggingRef.current = false

    let isDragging = false
    let ghostEl: HTMLElement | null = null
    let dropIndicatorEl: HTMLElement | null = null

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      const dist = Math.hypot(dx, dy)

      if (!isDragging && dist > 4) {
        isDragging = true
        wasDraggingRef.current = true
        setIsDraggingThis(true)

        ghostEl = createDragGhost(node.attrs.chord as string)
        dropIndicatorEl = createDropIndicator()
        document.body.appendChild(ghostEl)
        document.body.appendChild(dropIndicatorEl)
        document.body.classList.add('is-dragging-chord')
      }

      if (isDragging && ghostEl && dropIndicatorEl) {
        ghostEl.style.left = `${moveEvent.clientX}px`
        ghostEl.style.top = `${moveEvent.clientY - 12}px`

        const target = computeDropTarget(editor, moveEvent.clientX, moveEvent.clientY)
        if (target) {
          dropIndicatorEl.style.display = 'block'
          dropIndicatorEl.style.left = `${target.rect.left}px`
          dropIndicatorEl.style.top = `${target.rect.top}px`
          dropIndicatorEl.style.height = `${target.rect.height}px`
        } else {
          dropIndicatorEl.style.display = 'none'
        }
      }
    }

    const cleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('is-dragging-chord')
      if (ghostEl) { ghostEl.remove(); ghostEl = null }
      if (dropIndicatorEl) { dropIndicatorEl.remove(); dropIndicatorEl = null }
      setIsDraggingThis(false)
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      cleanup()

      if (isDragging) {
        upEvent.preventDefault()
        upEvent.stopPropagation()

        const currentPos = typeof getPos === 'function' ? getPos() : null
        if (typeof currentPos === 'number') {
          const target = computeDropTarget(editor, upEvent.clientX, upEvent.clientY)
          if (target) {
            executeChordMove(editor, currentPos, target, node.attrs.chord as string)
          }
        }
      }
    }

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        cleanup()
        isDragging = false
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (wasDraggingRef.current) {
      e.preventDefault()
      e.stopPropagation()
      wasDraggingRef.current = false
      return
    }
    setEditValue(node.attrs.chord as string)
    setEditing(true)
  }

  const handleCommit = () => {
    const val = editValue.trim()
    if (val) updateAttributes({ chord: val })
    setEditing(false)
  }

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleCommit() }
    if (e.key === 'Escape') { setEditing(false) }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editValue === '') { deleteNode(); setEditing(false) }
    }
    e.stopPropagation()
  }

  return (
    <NodeViewWrapper
      as="span"
      className="chord-node-wrapper"
      contentEditable={false}
    >
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDownInput}
          className="chord-label"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid #1e3a8a',
            outline: 'none',
            color: '#1e3a8a',
            fontWeight: 'bold',
            fontSize: '14px',
            width: Math.max(editValue.length * 8, 36) + 'px',
            fontFamily: 'inherit',
            cursor: 'text',
          }}
        />
      ) : (
        <span
          className={`chord-label${selected ? ' chord-label--selected' : ''}${isDraggingThis ? ' chord-label--dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onDoubleClick={deleteNode}
          title="Click to edit • Drag to move • Double-click to delete"
        >
          {displayChord}
        </span>
      )}
    </NodeViewWrapper>
  )
}

// ── Paste helper: converts raw text lines → TipTap JSON content ──

function createParagraphWithChords(lyric: string, chords: Array<{ chord: string; col: number }>): object {
  const sorted = [...chords].sort((a, b) => a.col - b.col)
  const paragraphContent: object[] = []
  let cursor = 0

  for (const { chord, col } of sorted) {
    const insertAt = Math.min(col, lyric.length)
    if (insertAt > cursor) {
      paragraphContent.push({ type: 'text', text: lyric.slice(cursor, insertAt) })
    }
    paragraphContent.push({ type: 'chord', attrs: { chord } })
    cursor = insertAt
  }

  if (cursor < lyric.length) {
    paragraphContent.push({ type: 'text', text: lyric.slice(cursor) })
  }

  return {
    type: 'paragraph',
    content: paragraphContent.length > 0 ? paragraphContent : undefined
  }
}

/**
 * Converts raw pasted text lines into an array of TipTap paragraph JSON objects.
 * Handles both inline bracketed chords ("[C]Amazing [F]grace") and two-line chord sheets.
 */
function buildContentFromLines(lines: string[]): object[] {
  const content: object[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const expandedLine = line.replace(/\t/g, '    ')

    // Case 1: Inline bracketed chords in this line (e.g., "[C]Amazing [F]grace")
    if (hasInlineBracketedChords(expandedLine)) {
      const { lyric, chords } = parseInlineBracketedLine(expandedLine)
      if (chords.length > 0 && lyric.trim() !== '') {
        content.push(createParagraphWithChords(lyric, chords))
      } else if (chords.length > 0) {
        const paragraphContent: object[] = chords.flatMap(({ chord }) => [
          { type: 'chord', attrs: { chord } },
          { type: 'text', text: '  ' }
        ])
        content.push({ type: 'paragraph', content: paragraphContent })
      } else {
        content.push({ type: 'paragraph', content: [{ type: 'text', text: lyric }] })
      }
      i += 1
    }
    // Case 2: Chord-only line (e.g., "C        F         C")
    else if (isChordOnlyLine(expandedLine)) {
      const chordTokens = parseChordLine(expandedLine)
      const nextLine = i + 1 < lines.length ? lines[i + 1].replace(/\t/g, '    ') : undefined
      const nextIsLyric =
        nextLine !== undefined &&
        nextLine.trim() !== '' &&
        !isChordOnlyLine(nextLine) &&
        !hasInlineBracketedChords(nextLine)

      if (nextIsLyric) {
        // Chord + lyric pair: merge into one paragraph
        let lyric = nextLine as string
        const maxCol = chordTokens.reduce((max, c) => Math.max(max, c.col), 0)
        if (maxCol > lyric.length) {
          lyric = lyric.padEnd(maxCol + 2, ' ')
        }

        content.push(createParagraphWithChords(lyric, chordTokens))
        i += 2
      } else {
        // Standalone chord line: paragraph of chord nodes
        const paragraphContent: object[] = chordTokens.flatMap(({ chord }) => [
          { type: 'chord', attrs: { chord } },
          { type: 'text', text: '  ' }
        ])
        content.push({ type: 'paragraph', content: paragraphContent })
        i += 1
      }
    }
    // Case 3: Empty line
    else if (line.trim() === '') {
      content.push({ type: 'paragraph' })
      i += 1
    }
    // Case 4: Regular lyric line or section header
    else {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] })
      i += 1
    }
  }

  return content
}

/**
 * Automatically adjusts horizontal positioning of adjacent chord labels
 * if they overlap, without modifying or shifting the underlying lyric text.
 */
export function resolveChordOverlaps(dom: HTMLElement) {
  if (!dom) return

  const paragraphs = dom.querySelectorAll('p')
  paragraphs.forEach(p => {
    const wrappers = Array.from(p.querySelectorAll('.chord-node-wrapper')) as HTMLElement[]
    if (wrappers.length === 0) return

    let lastRight = -Infinity
    let lastTop = -Infinity

    const scale = dom.getBoundingClientRect().width / dom.offsetWidth || 1

    wrappers.forEach(wrapper => {
      const label = wrapper.querySelector('.chord-label') as HTMLElement
      if (!label) return

      // Temporarily clear transform to measure natural position
      label.style.transform = ''
      const rect = label.getBoundingClientRect()
      const pRect = p.getBoundingClientRect()

      const currentTop = rect.top
      // Reset if chord wraps to next visual line
      if (Math.abs(currentTop - lastTop) > 12 * scale) {
        lastRight = -Infinity
        lastTop = currentTop
      }

      const naturalLeft = rect.left - pRect.left
      const labelWidth = rect.width
      const gap = 4 * scale // 4px minimum gap between chord pills in screen space

      if (naturalLeft < lastRight + gap) {
        const desiredLeft = lastRight + gap
        const shiftXScreen = Math.round(desiredLeft - naturalLeft)
        const shiftXLocal = Math.round(shiftXScreen / scale)
        label.style.transform = `translateX(${shiftXLocal}px)`
        lastRight = desiredLeft + labelWidth
      } else {
        label.style.transform = ''
        lastRight = naturalLeft + labelWidth
      }
    })
  })
}

// ── TipTap Node Extension ──

export const ChordExtension = Node.create({
  name: 'chord',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      chord: {
        default: 'C',
        parseHTML: (element) => element.getAttribute('data-chord') ?? 'C',
        renderHTML: (attributes) => ({ 'data-chord': attributes.chord })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-chord]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'chord-node-wrapper', contenteditable: 'false' }),
      ['span', { class: 'chord-label' }, HTMLAttributes['data-chord'] ?? '']
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChordNodeView, { as: 'span' })
  },

  addCommands() {
    return {
      insertChord:
        (chord: string) =>
          ({ commands }) => {
            return commands.insertContent({
              type: 'chord',
              attrs: { chord }
            })
          },

      transposeAllChords:
        (semitones: number) =>
          ({ tr, state, dispatch }) => {
            const preferFlats = semitones < 0
            let changed = false

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'chord') {
                const newChord = transposeChord(
                  node.attrs.chord as string,
                  semitones,
                  preferFlats
                )
                if (newChord !== node.attrs.chord) {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    chord: newChord
                  })
                  changed = true
                }
              }
            })

            if (changed && dispatch) dispatch(tr)
            return true
          },

      findNextChord:
        (chord: string) =>
          ({ tr, state, dispatch }) => {
            let foundPos = -1
            const currentPos = state.selection.from

            // Search after current position
            state.doc.descendants((node, pos) => {
              if (foundPos === -1 && node.type.name === 'chord' && (node.attrs.chord as string).toLowerCase() === chord.toLowerCase() && pos > currentPos) {
                foundPos = pos
              }
            })

            // If not found, wrap around and search from beginning
            if (foundPos === -1) {
              state.doc.descendants((node, pos) => {
                if (foundPos === -1 && node.type.name === 'chord' && (node.attrs.chord as string).toLowerCase() === chord.toLowerCase() && pos <= currentPos) {
                  foundPos = pos
                }
              })
            }

            if (foundPos !== -1) {
              if (dispatch) {
                const selection = NodeSelection.create(state.doc, foundPos)
                tr.setSelection(selection)
                tr.scrollIntoView()
                dispatch(tr)
              }
              return true
            }
            return false
          },

      replaceCurrentChord:
        (find: string, replace: string) =>
          ({ tr, state, dispatch }) => {
            const { selection } = state
            if (
              selection instanceof NodeSelection &&
              selection.node.type.name === 'chord' &&
              (selection.node.attrs.chord as string).toLowerCase() === find.toLowerCase()
            ) {
              if (dispatch) {
                tr.setNodeMarkup(selection.from, undefined, { ...selection.node.attrs, chord: replace })
                dispatch(tr)
              }
              return true
            }
            return false
          },

      replaceAllChords:
        (find: string, replace: string) =>
          ({ tr, state, dispatch }) => {
            let changed = false
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'chord' && (node.attrs.chord as string).toLowerCase() === find.toLowerCase()) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  chord: replace
                })
                changed = true
              }
            })
            if (changed && dispatch) dispatch(tr)
            return changed
          }
    }
  },

  addKeyboardShortcuts() {
    return {
      // Backspace on a selected chord node deletes it
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        if (selection.empty && selection.$anchor.nodeBefore?.type.name === 'chord') {
          return editor.commands.deleteSelection()
        }
        return false
      }
    }
  },

  addProseMirrorPlugins() {
    // `this.editor` is the live TipTap editor instance
    const tiptapEditor = this.editor

    return [
      new Plugin({
        key: new PluginKey('chordOverlapResolver'),
        view() {
          return {
            update(view) {
              requestAnimationFrame(() => {
                resolveChordOverlaps(view.dom)
              })
            }
          }
        }
      }),
      new Plugin({
        key: new PluginKey('chordPaste'),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData('text/plain')
            if (!text) return false

            const lines = text.split(/\r?\n/)
            // Intercept paste if text contains chord lines or inline bracketed chords
            const hasChords = lines.some(line => isChordOnlyLine(line) || hasInlineBracketedChords(line))
            if (!hasChords) return false

            const content = buildContentFromLines(lines)
            if (content.length === 0) return false

            // Use TipTap's chain API to replace selection and insert structured content
            tiptapEditor.chain().deleteSelection().insertContent(content).run()
            return true // prevent default paste
          }
        }
      })
    ]
  }
})
