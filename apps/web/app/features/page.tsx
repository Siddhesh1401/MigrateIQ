import React from 'react';
import Link from 'next/link';

export default function FeaturesPage() {
  return (
    <div className="container" style={{ padding: '80px 24px', minHeight: '60vh', textAlign: 'center' }}>
      <span className="badge badge-brand" style={{ marginBottom: '16px' }}>Under Construction · Step 4</span>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>All 12 Features</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 32px' }}>
        The deep-dive interactive features page will be built right after How It Works!
      </p>
      <Link href="/" className="btn-secondary">
        ← Back to Home
      </Link>
    </div>
  );
}
