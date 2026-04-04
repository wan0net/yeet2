import { defineConfig } from "vitepress";

export default defineConfig({
  title: "yeet2",
  description: "Self-hosted autonomous software-team platform",
  base: "/yeet2/",
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Spec", link: "/SPEC" },
      { text: "Architecture", link: "/ARCHITECTURE" },
      { text: "Flows", link: "/DATA_FLOWS" },
      { text: "Operations", link: "/OPERATIONS" },
      { text: "Development", link: "/DEVELOPMENT" }
    ],
    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Home", link: "/" },
          { text: "Vision", link: "/VISION" },
          { text: "Spec", link: "/SPEC" },
          { text: "Product Spec", link: "/PRODUCT_SPEC" },
          { text: "Roadmap", link: "/ROADMAP" }
        ]
      },
      {
        text: "System",
        items: [
          { text: "Architecture", link: "/ARCHITECTURE" },
          { text: "Data Flows", link: "/DATA_FLOWS" },
          { text: "Operations", link: "/OPERATIONS" },
          { text: "Development", link: "/DEVELOPMENT" },
          { text: "CI/CD", link: "/CI_CD" },
          { text: "Decisions", link: "/DECISIONS" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/wan0net/yeet2" }
    ],
    search: {
      provider: "local"
    },
    footer: {
      message: "BSD-3-Clause",
      copyright: "yeet2"
    }
  }
});
