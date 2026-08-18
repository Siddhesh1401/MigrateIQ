import React from 'react';
import Link from 'next/link';

export default function DownloadPage() {
  return (
    <div className="container" style={{ padding: '80px 24px', minHeight: '60vh', textAlign: 'center' }}>
      <span className="badge badge-success" style={{ marginBottom: '16px' }}>Under Construction · Step 5</span>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Download MigrateIQ</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 32px' }}>
        The official download portal with system requirements and FAQ will be built in Step 5!
      </p>
      <Link href="/" className="btn-secondary">
        ← Back to Home
      </Link>
    </div>
  );
}
