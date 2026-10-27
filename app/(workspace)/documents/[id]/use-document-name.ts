"use client";

import { useEffect, useState } from "react";

type DocumentName = { name: string | null; missing: boolean; failed: boolean };

/**
 * The name a link block shows for the document it points at (`doc-link`,
 * `block-link`). The catalogue answers it, not the document itself: asking
 * Yorkie would mean attaching to a document nobody is reading.
 *
 * Only a 404 is `missing`: FR-023-04 deletes documents and nothing rewrites the
 * links to them, so a target that is gone is a state the block renders. Any
 * other failure (offline, a lapsed session, a server error) says nothing about
 * the target, so it is `failed` and `retry` asks again.
 */
export function useDocumentName(documentId: string): DocumentName & { retry: () => void } {
  const [state, setState] = useState<DocumentName>({ name: null, missing: false, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const failed = () => {
      if (!cancelled) setState((current) => ({ ...current, failed: true }));
    };

    fetch(`/api/documents/${documentId}`)
      .then(async (response) => {
        if (response.status === 404) {
          if (!cancelled) setState({ name: null, missing: true, failed: false });
          return;
        }
        if (!response.ok) return failed();
        const body = await response.json();
        if (!cancelled) setState({ name: body.document?.name ?? null, missing: false, failed: false });
      })
      .catch(failed);

    return () => {
      cancelled = true;
    };
  }, [documentId, attempt]);

  return {
    ...state,
    retry: () => {
      setState((current) => ({ ...current, failed: false }));
      setAttempt((count) => count + 1);
    },
  };
}
