'use client';

import { useEffect, useRef, useState } from 'react';
import yorkie from '@yorkie-js/sdk';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { exampleSetup } from 'prosemirror-example-setup';
import {
  YorkieProseMirrorBinding,
  remoteSelectionPlugin,
} from '@yorkie-js/prosemirror';
import { pmSchema } from '@/lib/pm-schema';
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-menu/style/menu.css';

const YORKIE_ADDR =
  process.env.NEXT_PUBLIC_YORKIE_ADDR ?? 'http://localhost:8080';

const initialDoc = pmSchema.node('doc', null, [
  pmSchema.node('heading', { level: 2 }, [
    pmSchema.text('Collaborative ProseMirror'),
  ]),
  pmSchema.node('paragraph', null, [
    pmSchema.text('Start editing to collaborate in real time.'),
  ]),
]);

export default function ProseMirrorSpikePage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting…');
  // Events go on the page, not the console: Next dev intercepts console output
  // and forwards it to the terminal, so console logs are not trustworthy here.
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    let disposed = false;

    const log = (line: string) =>
      setEvents((prev) =>
        [...prev, `${new Date().toISOString().slice(11, 23)} ${line}`].slice(-40),
      );

    const client = new yorkie.Client({ rpcAddr: YORKIE_ADDR });
    const docKey =
      new URLSearchParams(window.location.search).get('key') ||
      `pm-spike-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    const setup = (async () => {
      let view: EditorView | undefined;
      let binding: YorkieProseMirrorBinding | undefined;
      try {
        await client.activate();
        log(`client activated ${client.getID()}`);

        const doc = new yorkie.Document<Record<string, unknown>>(docKey);

        // The three subscriptions that say whether the watch stream is alive.
        doc.subscribe((e) => log(`doc: ${e.type}`));
        doc.subscribe('connection', (e) => log(`connection: ${e.value}`));
        doc.subscribe('sync', (e) => log(`sync: ${e.value}`));

        await client.attach(doc, { initialPresence: {} });
        log(`attached to ${docKey}`);
        if (disposed) return { client, view, binding };

        view = new EditorView(editorRef.current, {
          state: EditorState.create({
            doc: initialDoc,
            plugins: [
              ...exampleSetup({ schema: pmSchema }),
              remoteSelectionPlugin(),
            ],
          }),
        });

        binding = new YorkieProseMirrorBinding(view, doc, 'tree', {
          client,
          onLog: (type, message) => log(`binding[${type}]: ${message}`),
          cursors: {
            enabled: true,
            overlayElement: overlayRef.current!,
            wrapperElement: wrapperRef.current!,
          },
        });
        // Adopts an existing Yorkie tree if there is one, seeds it from
        // `initialDoc` only when the document is empty.
        binding.initialize();
        view.focus();

        setStatus(`Connected — ${docKey}`);
      } catch (e) {
        setStatus(`Failed: ${(e as Error).message}`);
        log(`ERROR ${(e as Error).message}`);
      }
      return { client, view, binding };
    })();

    return () => {
      disposed = true;
      // Wait for setup to finish before tearing down. Tearing down mid-attach
      // (which StrictMode's double-invoke does) leaves a client attached with
      // nothing pointing at it.
      setup.then(({ client, view, binding }) => {
        binding?.destroy();
        view?.destroy();
        client.deactivate();
      });
    };
  }, []);

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <p style={{ fontFamily: 'monospace', marginBottom: '1rem' }}>{status}</p>
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <div ref={editorRef} />
        <div
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />
      </div>
      <pre
        style={{
          marginTop: '2rem',
          padding: '0.75rem',
          background: '#111',
          color: '#0f0',
          fontSize: 11,
          maxHeight: 260,
          overflow: 'auto',
        }}
      >
        {events.join('\n')}
      </pre>
    </main>
  );
}
