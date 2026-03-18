import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@solana/web3.js", "@pump-fun/pump-sdk", "bs58", "@solana/spl-token"],
};

export default nextConfig;
