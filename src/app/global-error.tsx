"use client";

// Last-resort boundary for errors in the root layout. It must render its own <html>/<body>,
// and does not rely on global CSS. The error object is not rendered.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          textAlign: "center",
          padding: "16px",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>Please try again in a moment.</p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button type="button" onClick={reset} style={{ padding: "8px 16px" }}>
            Try again
          </button>
          <a href="/dashboard" style={{ padding: "8px 16px" }}>
            Back to dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
