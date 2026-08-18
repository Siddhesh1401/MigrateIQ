import React from 'react';
import type { Metadata } from 'next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'MigrateIQ — Intelligent Database Migration Planner',
  description: 'AI-assisted schema mapping, risk analysis, dry-run simulation, and guided database migration from MongoDB to PostgreSQL.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
