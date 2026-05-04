# Doclexia

**Never lose track of where you are in a document.**

Doclexia is a specialized document reader designed to enhance focus, accessibility, and reading retention. It strips away distractions, normalizes document formatting, and provides a customizable word-by-word reading interface tailored for maximum legibility.

## Features

- **Format Agnostic**: Instantly loads `.docx`, `.md`, `.html`, and `.txt` files directly in the browser.
- **Word-by-Word Reading**: Focus on one word at a time with adjustable speeds and manual control.
- **Auto-Skip Headings**: Automatically skips past formatting tags and headings so you only read the core content.
- **Dyslexia-Optimized Typography**: Built-in support for OpenDyslexic, Lexend, and high-legibility Serif fonts.
- **Persistent State**: Closes the tab? Refreshes the page? Doclexia automatically restores your active document and exact reading position using local IndexedDB caching!
- **Mobile First**: Fully responsive with custom touch gesture controls and bulletproof Android/iOS selection blocking.
- **Quick Paste**: Press `Ctrl+V` anywhere on the homepage to instantly load copied text or files into the reader.
- **100% Local**: All processing, parsing, and caching happens locally on your device. No data is sent to any server, ever!

## Technologies Used

- [Next.js](https://nextjs.org/) (React Framework)
- [Tailwind CSS](https://tailwindcss.com/)
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js/) (for robust `.docx` parsing)
- Native `IndexedDB` for offline document caching
- Deployed via GitHub Pages
