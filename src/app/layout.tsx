import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Instagram Carousel Studio',
  description: 'Analyze, generate, and auto-post unique Instagram carousels powered by AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950">
        <div className="flex min-h-screen">
          <Navigation />
          <main className="flex-1 ml-64 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
