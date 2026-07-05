import './globals.css';

export const metadata = {
  title: 'Pole Load Calculator',
  description: 'Calculate forces and bending moments on utility poles with multiple conductor levels.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
