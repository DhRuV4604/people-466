import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PeoplePay360 — HR & Payroll',
  description: 'An integrated human resource and payroll operations platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
