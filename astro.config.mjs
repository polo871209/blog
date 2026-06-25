import { defineConfig } from "astro/config";
import { visit } from "unist-util-visit";

// Hugo {{< mermaid >}} became ```mermaid fences during migration.
// Turn those fences into raw <pre class="mermaid"> so the client lib renders them.
function remarkMermaid() {
  return (tree) => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang === "mermaid" && parent && typeof index === "number") {
        parent.children[index] = {
          type: "html",
          value: `<pre class="mermaid">\n${node.value}\n</pre>`,
        };
      }
    });
  };
}

export default defineConfig({
  site: "https://polo.is-not-a.dev",
  // Inline the (tiny) stylesheet into each page -> no render-blocking CSS request.
  build: { inlineStylesheets: "always" },
  vite: { build: { cssMinify: "lightningcss" } },
  markdown: {
    remarkPlugins: [remarkMermaid],
    shikiConfig: { theme: "kanagawa-wave", wrap: false },
  },
});
