import React from 'react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="container" style={{ padding: '80px 24px', minHeight: '60vh', textAlign: 'center' }}>
      <span className="badge badge-ai" style={{ marginBottom: '16px' }}>Under Construction · Step 6</span>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>About the Project & Team</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 32px' }}>
        The team presentation and project mission page will be built in Step 6!
      </p>
      <Link href="/" className="btn-secondary">
        ← Back to Home
      </Link>
    </div>
  );
}
