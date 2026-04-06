'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const links = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/analyze', label: 'New Carousel', icon: '✨' },
  { href: '/scheduled', label: 'Scheduled', icon: '🕐' },
  { href: '/avatar', label: 'Avatar', icon: '👤' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
            📸
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">Carousel</div>
            <div className="text-xs instagram-gradient-text font-semibold">Studio</div>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              pathname === link.href
                ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            )}
          >
            <span className="text-base">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-600 text-center">
          Powered by Claude AI + DALL-E 3
        </div>
      </div>
    </aside>
  );
}
