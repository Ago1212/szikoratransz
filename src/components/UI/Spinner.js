import React from "react";

export default function Spinner({ className = "h-10 w-10", wrapperClassName = "flex justify-center p-10" }) {
  return (
    <div className={wrapperClassName}>
      <div
        className={`animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${className}`}
      />
    </div>
  );
}
