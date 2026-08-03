import { Fragment } from "react";

import type { BriefBlock, BriefInlineNode } from "../../lib/dashboard-types";

function InlineContent({ content }: { content: BriefInlineNode[] }) {
  return content.map((node, index) => {
    const key = `${node.type}-${index}`;

    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.text}</Fragment>;
      case "strong":
        return <strong key={key}>{node.text}</strong>;
      case "code":
        return <code key={key}>{node.text}</code>;
      case "link":
        return (
          <a key={key} href={node.href} rel="noreferrer">
            {node.text}
          </a>
        );
    }
  });
}

function ArtifactBlock({ block }: { block: BriefBlock }) {
  switch (block.type) {
    case "heading": {
      const content = <InlineContent content={block.content} />;

      if (block.level === 2) return <h2>{content}</h2>;
      if (block.level === 3) return <h3>{content}</h3>;
      return <h4>{content}</h4>;
    }
    case "paragraph":
      return (
        <p>
          <InlineContent content={block.content} />
        </p>
      );
    case "list": {
      const items = block.items.map((item, index) => (
        <li key={index}>
          <InlineContent content={item} />
        </li>
      ));

      return block.ordered ? <ol start={block.start}>{items}</ol> : <ul>{items}</ul>;
    }
    case "table":
      return (
        <div className="brief-table-scroll">
          <table>
            <thead>
              <tr>
                {block.headers.map((header, index) => (
                  <th key={index} scope="col">
                    <InlineContent content={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      <InlineContent content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function ArtifactContent({ blocks }: { blocks: BriefBlock[] }) {
  return blocks.map((block, index) => <ArtifactBlock key={index} block={block} />);
}
