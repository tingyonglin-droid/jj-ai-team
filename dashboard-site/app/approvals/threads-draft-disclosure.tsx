"use client";

import { useId, useReducer } from "react";

import type { BriefBlock } from "../../lib/dashboard-types";
import { ArtifactContent } from "./artifact-content";

export function threadsDraftDisclosureReducer(state: boolean, event: "toggle"): boolean {
  return event === "toggle" ? !state : state;
}

export function ThreadsDraftDisclosure({
  blocks,
  source,
}: {
  blocks: BriefBlock[] | null;
  source: string;
}) {
  const panelId = useId();
  const [expanded, dispatch] = useReducer(threadsDraftDisclosureReducer, false);

  if (!blocks?.length) {
    return (
      <p className="error-text">
        完整草稿無法載入：{source}。重新產生 Dashboard 快照後再審閱。
      </p>
    );
  }

  return (
    <section aria-label="Threads 完整草稿">
      <button
        type="button"
        className="text-link threads-draft-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => dispatch("toggle")}
      >
        {expanded ? "收合草稿" : "查看完整草稿"}
      </button>
      {expanded ? (
        <div id={panelId} className="threads-draft-content">
          <ArtifactContent blocks={blocks} />
        </div>
      ) : null}
    </section>
  );
}
