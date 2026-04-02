import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yeet2/domain", "@yeet2/ui"],
  typedRoutes: true
};

export default nextConfig;
