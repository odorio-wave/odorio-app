"use client";
import React, { useEffect } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
};

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // 3秒後に自動で消える
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!message) return null;

  const bgColors = {
    success: "bg-gray-800", // 黒ベースでスタイリッシュに
    error: "bg-red-600",
    info: "bg-blue-600",
  };

  return (
    <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
      <div className={`${bgColors[type]} text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold`}>
        {type === "success" && "✅"}
        {type === "error" && "⚠️"}
        <span>{message}</span>
      </div>
    </div>
  );
}