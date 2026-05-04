# Doclexia

**Never lose track of where you are in a document.**

Doclexia is basically a specialized document reader designed to enhance focus, accessibility, and reading retention.
It strips away distractions, normalizes document formatting, and provides a customizable word-by-word reading interface, now you don't get lost!

Works on desktop and mobile! iOS or Android - Windows or macOS

**[Try it → skyade.github.io/doclexia](https://skyade.github.io/doclexia/)**

## Features

Doclexia loads `.docx`, `.md`, `.html`, and `.txt` files directly in the browser and reads them back word by word at whatever speed you set, headings and formatting tags skipped automatically, so only the actual content comes through.

Font options include OpenDyslexic, Lexend, and high-legibility serifs. Close the tab, refresh, whatever, it restores your document and exact position from local IndexedDB cache.

Paste anything with `Ctrl+V` on the homepage and it loads instantly.
Touch controls work on mobile, Android/iOS selection blocking is handled, and nothing ever leaves your device, all parsing, processing, and caching is local only.

## Technologies Used (Nerd)

- [Next.js](https://nextjs.org/) (React Framework)
- [Tailwind CSS](https://tailwindcss.com/)
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js/) (for robust `.docx` parsing)
- Native `IndexedDB` for offline document caching
