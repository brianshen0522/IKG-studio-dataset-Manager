'use client';

export default function DbOfflineBanner() {
  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.iconWrap}>
          <span style={s.icon}>⚠</span>
        </div>
        <h2 style={s.title}>Database Offline</h2>
        <p style={s.body}>
          The database is currently unreachable.<br />
          Please contact your administrator.
        </p>
        <button style={s.retry} onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(circle at 20% 20%, #15233a, #0a111f 50%), #0d1626',
    fontFamily: '"Nunito Sans", "Segoe UI", system-ui, sans-serif',
  },
  card: {
    background: '#152033', border: '1px solid #d24343',
    borderRadius: '16px', padding: '2.5rem 2rem',
    maxWidth: '380px', width: '100%', textAlign: 'center',
    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  },
  iconWrap: { marginBottom: '1rem' },
  icon: { fontSize: '2.5rem', color: '#d24343' },
  title: { fontSize: '1.4rem', fontWeight: 800, color: '#f87171', margin: '0 0 0.75rem' },
  body: { color: '#9ba9c3', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.5rem' },
  retry: {
    background: '#e45d25', border: 'none', borderRadius: '8px',
    color: '#fff', cursor: 'pointer', fontSize: '0.9rem',
    fontWeight: 700, padding: '0.65rem 2rem',
  },
};
