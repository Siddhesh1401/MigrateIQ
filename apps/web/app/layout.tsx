import React from 'react';
import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'MigrateIQ — Intelligent Database Migration Planner',
  description: 'AI-assisted schema mapping, risk analysis, dry-run simulation, and guided database migration from MongoDB to PostgreSQL.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
