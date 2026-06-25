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
  markdown: {
    remarkPlugins: [remarkMermaid],
    shikiConfig: { theme: "kanagawa-wave", wrap: false },
  },
  // Preserve old Hugo /posts/<slug>/ permalinks (frontmatter aliases).
  redirects: {
    "/posts/apko_container_builder/": "/logs/apko_container_builder/",
    "/posts/container_crane/": "/logs/container_crane/",
    "/posts/istio_ambient_networking/": "/logs/istio_ambient_networking/",
    "/posts/scaling_prometheus_with_thanos/":
      "/logs/scaling_prometheus_with_thanos/",
    "/posts/smart_canary_deployments/": "/logs/smart_canary_deployments/",
    "/posts/understanding_bazel_with_distroless/":
      "/logs/understanding_bazel_with_distroless/",
    "/posts/wolfi_made_easy/": "/logs/wolfi_made_easy/",
    "/posts/ebpf_cilium/": "/logs/ebpf_cilium/",
    "/posts/kubernetes_dns_fqdn/": "/logs/kubernetes_dns_fqdn/",
    "/posts/pause_container_kubernetes/": "/logs/pause_container_kubernetes/",
  },
});
