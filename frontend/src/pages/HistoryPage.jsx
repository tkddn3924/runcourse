import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import api from '../api';
import 'leaflet/dist/leaflet.css';

const TYPE_LABELS = {
  uphill: { name: '업힐', icon: '⛰️', color: '#FF6D00' },
  flat: { name: '평지', icon: '🏃', color: '#00C853' },
  sprint: { name: '스프린트', icon: '⚡', color: '#F44336' },
  interval: { name: '인터벌', icon: '🔄', color: '#9C27B0' },
  zone2: { name: '존2', icon: '❤️', color: '#2196F3' },
  free: { name: '프리런', icon: '🏃', color: '#00C853' },
};

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatTime(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MiniMap({ route }) {
  if (!route || route.length < 2) return null;
  const polyline = route.map((p) => [p.lat, p.lng]);
  const center = polyline[Math.floor(polyline.length / 2)];

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: '120px', width: '100%', borderRadius: '10px' }}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Polyline positions={polyline} color="#00C853" weight={3} />
    </MapContainer>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/runs')
      .then((res) => setRuns(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('이 러닝 기록을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/runs/${id}`);
      setRuns(runs.filter((r) => r.id !== id));
    } catch {
      alert('삭제에 실패했습니다');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>← 홈</button>
        <h2 style={styles.title}>러닝 기록</h2>
        <div style={{ width: '60px' }} />
      </header>

      {loading ? (
        <div style={styles.loading}>기록을 불러오는 중...</div>
      ) : runs.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: '48px' }}>🏃</span>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
            아직 러닝 기록이 없습니다
          </p>
          <button onClick={() => navigate('/')} style={styles.goRunBtn}>
            첫 러닝 시작하기
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {runs.map((run) => {
            const typeInfo = TYPE_LABELS[run.course_type] || TYPE_LABELS.free;
            return (
              <div key={run.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <span style={{ ...styles.typeTag, background: `${typeInfo.color}20`, color: typeInfo.color }}>
                      {typeInfo.icon} {typeInfo.name}
                    </span>
                    <span style={styles.date}>{formatDate(run.started_at)}</span>
                  </div>
                  <button onClick={() => handleDelete(run.id)} style={styles.deleteBtn}>🗑️</button>
                </div>

                {run.route && run.route.length > 1 && (
                  <div style={styles.miniMapWrapper}>
                    <MiniMap route={run.route} />
                  </div>
                )}

                <div style={styles.cardStats}>
                  <div style={styles.cardStat}>
                    <span style={styles.cardStatValue}>{run.distance_km?.toFixed(2) || '0.00'}</span>
                    <span style={styles.cardStatLabel}>km</span>
                  </div>
                  <div style={styles.cardStat}>
                    <span style={styles.cardStatValue}>{formatTime(run.duration_seconds)}</span>
                    <span style={styles.cardStatLabel}>시간</span>
                  </div>
                  <div style={styles.cardStat}>
                    <span style={styles.cardStatValue}>
                      {run.avg_pace ? `${run.avg_pace.toFixed(1)}'` : '-'}
                    </span>
                    <span style={styles.cardStatLabel}>페이스</span>
                  </div>
                  <div style={styles.cardStat}>
                    <span style={styles.cardStatValue}>{run.calories || '-'}</span>
                    <span style={styles.cardStatLabel}>kcal</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '0 20px 40px',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
    borderBottom: '1px solid var(--border)',
    marginBottom: '20px',
  },
  backBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '14px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
  },
  loading: {
    textAlign: 'center',
    padding: '60px 0',
    color: 'var(--text-secondary)',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
  },
  goRunBtn: {
    marginTop: '20px',
    padding: '14px 32px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--primary)',
    color: '#000',
    fontSize: '16px',
    fontWeight: '700',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '18px',
    border: '1px solid var(--border)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  typeTag: {
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    marginRight: '10px',
  },
  date: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  deleteBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    fontSize: '14px',
    cursor: 'pointer',
  },
  miniMapWrapper: {
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  cardStats: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  cardStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  cardStatValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  cardStatLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
};
