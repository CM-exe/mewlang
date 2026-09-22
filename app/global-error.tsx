'use client';

// This replaces the *entire* root layout (html/body included) when an error
// is thrown somewhere the root layout itself can't recover from — so unlike
// every other page, it can't rely on app/layout.tsx having run: no
// <FloatingMenu/>/<CourseNav/>, and its own './globals.css' import below,
// not layout.tsx's, is what makes Tailwind's classes available here at all.
import './globals.css';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="theme-index">
        <div className="wrap">
          <header className="masthead">
            <p className="kicker">Error</p>
            <h1>Something broke</h1>
            <p className="lede">
              An unexpected error stopped this page from rendering. Reloading usually fixes it —
              if it keeps happening, it is worth reporting.
            </p>
          </header>
          <p>
            <button type="button" className="button" onClick={() => reset()}>
              Try again
            </button>
          </p>
          <p>
            <a href="/">Back to Mewlang</a>
          </p>
        </div>
      </body>
    </html>
  );
}
