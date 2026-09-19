"use client";

import { Streamdown } from "streamdown";
import { createCodePlugin } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";

const code = createCodePlugin({
  themes: ["monokai", "monokai"],
});

export function Markdown({ content, isAnimating }: { content: string, isAnimating?: boolean }) {
  return (
    <Streamdown plugins={{ code, mermaid }} isAnimating={isAnimating}>
      {content}
    </Streamdown>
  );
}
