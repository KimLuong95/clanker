"use client";

import { useState } from "react";

interface CopyButtonProps {
  address: string;
  compact?: boolean; // slim version for top bar
}

export function CopyButton({ address, compact }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleCopy}
        className="mono text-xs cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded"
        style={{
          background: copied ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.3)",
          transition: "all 0.2s",
        }}
        title={copied ? "Copied!" : `Copy CA`}
      >
        {copied ? "✓ COPIED" : "⧉ COPY"}
      </button>
    );
  }

  const truncated =
    address === "PLACEHOLDER_MINT_ADDRESS"
      ? "CA coming soon..."
      : `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <button
      onClick={handleCopy}
      disabled={address === "PLACEHOLDER_MINT_ADDRESS"}
      className={`spy-button mono px-5 py-3 rounded-lg text-sm cursor-pointer flex items-center gap-2 ${
        copied ? "copy-success" : ""
      } ${address === "PLACEHOLDER_MINT_ADDRESS" ? "opacity-50 cursor-not-allowed" : ""}`}
      title={copied ? "Copied!" : `Copy: ${address}`}
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>COPIED</span>
        </>
      ) : (
        <>
          <span className="opacity-60">⧉</span>
          <span>{truncated}</span>
        </>
      )}
    </button>
  );
}
