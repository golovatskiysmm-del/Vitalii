import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meditation Studio — AI Voice Generator',
  description: 'Создавайте персональные медитации своим голосом с помощью AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        {/* Background gradient */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-blue-900/20 rounded-full blur-3xl" />
        </div>
        {children}
      </body>
    </html>
  );
}
