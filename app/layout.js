import FloatingMenu from '../components/FloatingMenu';
import './globals.css';

export const metadata = {
  title: {
    default: 'Mewlang',
    template: '%s · Mewlang',
  },
  description:
    'Learn programming languages by building things that make each language worth learning.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
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
        {children}
      </body>
    </html>
  );
}
