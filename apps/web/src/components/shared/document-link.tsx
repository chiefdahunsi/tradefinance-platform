"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  documentId: string;
  fileName: string;
  className?: string;
}

/**
 * Fetches a short-lived signed URL from the API on click, then opens it.
 * Works for both S3 (signed URL) and local dev (direct URL).
 */
export function DocumentLink({ documentId, fileName, className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.get(`/api/documents/${documentId}/url`);
      window.open(data.data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Could not open the document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className ?? "text-xs text-blue-600 hover:underline font-medium disabled:opacity-50"}
    >
      {loading ? "Opening..." : "View"}
    </button>
  );
}
