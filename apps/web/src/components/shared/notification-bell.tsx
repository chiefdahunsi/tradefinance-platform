"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  applicationId: string;
  referenceNumber: string;
  commodityType: string;
  action: string;
  label: string;
  isDecision: boolean;
  decision?: string;
  createdAt: string;
}

const ACTION_ICON: Record<string, string> = {
  "APPLICATION:SUBMITTED": "📋",
  "KYC:PASSED": "✅",
  "KYC:FAILED": "⚠️",
  "ANALYST:ASSIGNED": "👤",
  "ANALYST:CREDIT_PROFILE_GENERATED": "📊",
  "ANALYST:DECISION_SUBMITTED": "🏦",
};

const DECISION_COLOR: Record<string, string> = {
  APPROVED: "text-green-600",
  DECLINED: "text-red-600",
  MORE_INFO_REQUIRED: "text-orange-600",
};

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    api.get("/api/notifications")
      .then((r) => setNotifications(r.data.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = Math.max(0, notifications.length - seenCount);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) setSeenCount(notifications.length);
  };

  const handleClick = (notif: Notification) => {
    setOpen(false);
    router.push(`/dashboard/applications/${notif.applicationId}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-slate-400 hover:text-slate-700 transition-colors"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No activity yet.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{ACTION_ICON[notif.action] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${notif.isDecision && notif.decision ? DECISION_COLOR[notif.decision] ?? "text-slate-900" : "text-slate-900"}`}>
                        {notif.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {notif.referenceNumber} · {notif.commodityType.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {new Date(notif.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
