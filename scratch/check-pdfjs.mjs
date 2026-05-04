import * as pdfjs from 'pdfjs-dist';
console.log('Keys:', Object.keys(pdfjs));
if (pdfjs.default) {
    console.log('Default Keys:', Object.keys(pdfjs.default));
}
console.log('Version:', pdfjs.version);
