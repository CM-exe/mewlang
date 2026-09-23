import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import FloatingMenu from '../components/FloatingMenu';
import CourseNav from '../components/CourseNav';
import CodeCopyButtons from '../components/CodeCopyButtons';
import './globals.css';

// No `icons` field here on purpose: app/favicon.ico (Next's file-convention
// icon) is picked up and served automatically with the correct basePath
// prefix. A hardcoded `icons: { icon: '/favicon.ico' }` would need the
// prefix built in by hand and was exactly the kind of hardcoded absolute
// path that broke on the GitHub Pages subpath deployment.
export const metadata: Metadata = {
  title: {
    default: 'Mewlang',
    template: '%s · Mewlang',
  },
  description:
    'Learn programming languages by building things that make each language worth learning.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <FloatingMenu />
        <CourseNav />
        {children}
        <CodeCopyButtons />
      </body>
    </html>
  );
}
