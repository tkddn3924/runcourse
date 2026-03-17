import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const COURSE_TYPES = [
  { id: 'uphill', name: '업힐 훈련', icon: '⛰️', color: '#FF6D00', desc: '오르막 중심' },
  { id: 'flat', name: '평지 러닝', icon: '🏃', color: '#00C853', desc: '평탄한 코스' },
  { id: 'sprint', name: '스프린트', icon: '⚡', color: '#F44336', desc: '짧고 빠르게' },
  { id: 'interval', name: '인터벌', icon: '🔄', color: '#9C27B0', desc: '구간 반복' },
  { id: 'zone2', name: '존2 러닝', icon: '❤️', color: '#2196F3', desc: '저강도 지구력' },
];

const DISTANCES = [3, 5, 7, 10, 15, 21];

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(null);
  const [selectedDistance, setSelectedDistance] = useState(5);
  const [customDistance, setCustomDistance] = useState('');
  const [generating, setGenerating] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError('위치 정보를 가져올 수 없습니다. 브라우저 설정을 확인해주세요.'),
      { enableHighAccuracy: true }
    );
    api.get('/stats').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedType) return;
    if (!location) {
      setLocationError('GPS 위치를 가져오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const dist = customDistance ? parseFloat(customDistance) : selectedDistance;
    if (isNaN(dist) || dist < 0.5 || dist > 50) return;

    setGenerating(true);
    try {
      const res = await api.post('/course/generate', {
        lat: location.lat,
        lng: location.lng,
        distance_km: dist,
        course_type: selectedType,
      });
      navigate('/course', { state: { course: res.data, courseType: selectedType, targetDistance: dist } });
    } catch (err) {
      alert(err.response?.data?.detail || '코스 생성에 실패했습니다');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>🏃 RunCourse</h1>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.username}>{user?.username}</span>
          <button onClick={() => navigate('/history')} style={styles.headerBtn}>기록</button>
          <button onClick={logout} style={styles.logoutBtn}>로그아웃</button>
        </div>
      </header>

      {/* Stats */}
      {stats && stats.total_runs > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.total_runs}</span>
            <span style={styles.statLabel}>총 러닝</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.total_distance_km}</span>
            <span style={styles.statLabel}>총 km</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.avg_pace}'</span>
            <span style={styles.statLabel}>평균 페이스</span>
          </div>
        </div>
      )}

      {/* Location Status */}
      <div style={styles.locationBar}>
        {location ? (
          <span style={styles.locationOk}>📍 GPS 연결됨</span>
        ) : locationError ? (
          <span style={styles.locationErr}>{locationError}</span>
        ) : (
          <span style={styles.locationLoading}>📡 위치 가져오는 중...</span>
        )}
      </div>

      {/* Course Type Selection */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>훈련 타입 선택</h2>
        <div style={styles.typeGrid}>
          {COURSE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              style={{
                ...styles.typeCard,
                borderColor: selectedType === type.id ? type.color : 'var(--border)',
                background: selectedType === type.id ? `${type.color}15` : 'var(--bg-card)',
              }}
            >
              <span style={styles.typeIcon}>{type.icon}</span>
              <span style={{ ...styles.typeName, color: selectedType === type.id ? type.color : 'var(--text)' }}>
                {type.name}
              </span>
              <span style={styles.typeDesc}>{type.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Distance Selection */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>거리 선택 (km)</h2>
        <div style={styles.distanceGrid}>
          {DISTANCES.map((d) => (
            <button
              key={d}
              onClick={() => { setSelectedDistance(d); setCustomDistance(''); }}
              style={{
                ...styles.distBtn,
                borderColor: selectedDistance === d && !customDistance ? 'var(--primary)' : 'var(--border)',
                background: selectedDistance === d && !customDistance ? 'rgba(0,200,83,0.15)' : 'var(--bg-card)',
                color: selectedDistance === d && !customDistance ? 'var(--primary)' : 'var(--text)',
              }}
            >
              {d}km
            </button>
          ))}
          <input
            type="number"
            placeholder="직접 입력"
            value={customDistance}
            onChange={(e) => setCustomDistance(e.target.value)}
            style={styles.customInput}
            min="0.5"
            max="50"
            step="0.5"
          />
        </div>
      </section>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!selectedType || generating || !location}
        style={{
          ...styles.generateBtn,
          opacity: (!selectedType || generating || !location) ? 0.5 : 1,
        }}
      >
        {generating ? (
          <span>코스 생성 중...</span>
        ) : (
          <span>🗺️ 러닝 코스 생성하기</span>
        )}
      </button>

      {/* Quick Start */}
      <button
        onClick={() => navigate('/run')}
        style={styles.quickStartBtn}
      >
        ▶ 바로 러닝 시작 (프리런)
      </button>
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
  logo: {
    fontSize: '22px',
    fontWeight: '900',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  username: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  headerBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '13px',
  },
  logoutBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'space-around',
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid var(--border)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  locationBar: {
    textAlign: 'center',
    padding: '12px',
    marginBottom: '24px',
  },
  locationOk: {
    color: 'var(--primary)',
    fontSize: '14px',
  },
  locationErr: {
    color: 'var(--danger)',
    fontSize: '14px',
  },
  locationLoading: {
    color: 'var(--warning)',
    fontSize: '14px',
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginBottom: '14px',
    color: 'var(--text)',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '10px',
  },
  typeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '16px 8px',
    borderRadius: '14px',
    border: '2px solid var(--border)',
    background: 'var(--bg-card)',
    transition: 'all 0.2s',
  },
  typeIcon: {
    fontSize: '28px',
  },
  typeName: {
    fontSize: '13px',
    fontWeight: '600',
  },
  typeDesc: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  distanceGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  distBtn: {
    padding: '12px 20px',
    borderRadius: '12px',
    border: '2px solid var(--border)',
    background: 'var(--bg-card)',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  customInput: {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '2px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text)',
    fontSize: '15px',
    width: '100px',
    outline: 'none',
  },
  generateBtn: {
    width: '100%',
    padding: '18px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
    color: '#000',
    fontSize: '18px',
    fontWeight: '800',
    marginBottom: '12px',
    transition: 'opacity 0.2s',
  },
  quickStartBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: '2px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '16px',
    fontWeight: '600',
  },
};
