// The exchange commits to the dark cyberpunk world — `dark` on <html> so the scanline/HUD overlay
// and every dark: utility apply with no flash.
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
