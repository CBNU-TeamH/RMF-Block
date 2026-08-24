import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';

/**
 * The ProseMirror schema for the editor spike page.
 *
 * The browser derives its mark -> Yorkie wrapper element mapping from this, so
 * it is the one declaration of what the spike editor can represent. It is not
 * the agreed block schema — that is `root.blocks` in
 * `docs/design/document-editing.md`, and the two are unrelated.
 */
export const pmSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
  marks: basicSchema.spec.marks,
});
