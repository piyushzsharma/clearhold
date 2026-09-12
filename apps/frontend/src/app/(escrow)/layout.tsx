import type { Metadata, Viewport } from 'next';
import './escrow-globals.css';
import { ToastProvider } from '@/components/v0/ui/toast';

export const metadata: Metadata = {
  title: 'ClearHold | Escrow dashboard',
  description: 'A secure, simple way to manage escrow transactions and protected funds.',
  generator: 'v0.app',
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f8fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
