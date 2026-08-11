import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';

/**
 * The ProseMirror schema, shared by the editor page and the watcher.
 *
 * Both ends must agree: the browser derives its mark -> Yorkie wrapper element
 * mapping from this schema, and the watcher validates `Node.fromJSON` against it
 * before rendering markdown. Two declarations that drift apart would keep
 * restoring fine (that path reads the Yorkie tree, not the schema) while quietly
 * producing wrong markdown, which nothing reads back.
 *
 * These nodes and marks are exactly what `defaultMarkdownSerializer` covers.
 */
export const pmSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
  marks: basicSchema.spec.marks,
});
