"use client";

import { useState } from "react";

interface CopyButtonProps {
  address: string;
}

export function CopyButton({ address }: CopyButtonProps) {
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
