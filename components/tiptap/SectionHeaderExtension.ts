import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { isMusicSectionHeader } from '../../utils/transposer'

export const SectionHeaderExtension = Extension.create({
  name: 'sectionHeader',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('sectionHeaderDecoration'),
        state: {
          init(_, { doc }) {
            return findSectionHeaderDecorations(doc)
          },
          apply(tr, oldSet, _oldState, newState) {
            if (tr.docChanged) {
              return findSectionHeaderDecorations(newState.doc)
            }
            return oldSet.map(tr.mapping, tr.doc)
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

function findSectionHeaderDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node: any, pos: number) => {
    if (node.isBlock && node.type.name === 'paragraph') {
      const text = node.textContent
      if (isMusicSectionHeader(text)) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: 'music-section-header'
          })
        )
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

export default SectionHeaderExtension
