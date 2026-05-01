import Link from 'next/link'

export default function RootNotFound() {
  return (
    <html lang="fr">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>404 — Page introuvable</h1>
          <p style={{ color: '#666', marginBottom: '1rem' }}>Cette page n&apos;existe pas.</p>
          <Link href="/fr" style={{ color: '#0070f3' }}>Retour à l&apos;accueil</Link>
        </div>
      </body>
    </html>
  )
}
