import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL('https://skyade.github.io/doclexia'),
  title: 'Doclexia',
  description: 'Never lose track of where you are in a document.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Doclexia',
    description: 'Never lose track of where you are in a document.',
    url: 'https://skyade.github.io/doclexia/',
    siteName: 'Doclexia',
    images: [
      {
        url: 'https://skyade.github.io/doclexia/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doclexia',
    description: 'Never lose track of where you are in a document.',
    images: ['https://skyade.github.io/doclexia/og-image.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#B3951E',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`bg-background text-foreground scroll-smooth ${geist.variable} ${geistMono.variable}`}>
      <head>
        <meta name="theme-color" content="#B3951E" />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const bg = localStorage.getItem('docviewer-bg');
            if (bg === 'dark') {
              document.documentElement.classList.add('dark');
              document.documentElement.style.backgroundColor = '#141414';
            } else {
              document.documentElement.style.backgroundColor = '#ffffff';
            }
          } catch (e) {}
        ` }} />
        <link rel="icon" href="https://skyade.github.io/doclexia/icon.png" />
        <link rel="apple-touch-icon" href="https://skyade.github.io/doclexia/apple-icon.png" />
        {/* Lexend (sans-serif) and Lora (serif) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
