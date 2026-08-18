import React from 'react';
import Link from 'next/link';

export default function HowItWorksPage() {
  return (
    <div className="container" style={{ padding: '80px 24px', minHeight: '60vh', textAlign: 'center' }}>
      <span className="badge badge-ai" style={{ marginBottom: '16px' }}>Under Construction · Step 2 Next</span>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>How It Works</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 32px' }}>
        We are building the visual 8-stage architecture walkthrough right now in Step 3!
      </p>
      <Link href="/" className="btn-secondary">
        ← Back to Home
      </Link>
    </div>
  );
}
