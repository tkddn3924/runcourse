import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const startIcon = new L.DivIcon({
  html: '<div style="background:#00C853;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,200,83,0.6)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: '',
});

const trafficLightIcon = new L.DivIcon({
  html: '<div style="background:#FF4444;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(255,68,68,0.8)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  className: '',
});

const TYPE_COLORS = {
  uphill: '#FF6D00',
  flat: '#00C853',
  sprint: '#F44336',
  interval: '#9C27B0',
  zone2: '#2196F3',
};

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export default function CoursePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { course, courseType, targetDistance } = location.state || {};

  if (!course) {
    navigate('/');
    return null;
  }

  const coords = course.coordinates || [];
  const polyline = coords.map((c) => [c.lat, c.lng]);
  const center = coords.length > 0 ? [coords[0].lat, coords[0].lng] : [37.5665, 126.978];
  const routeColor = TYPE_COLORS[courseType] || '#00C853';
  const trafficLights = course.traffic_lights_on_route || [];

  const handleStartRun = () => {
    navigate('/run', {
      state: {
        plannedRoute: coords,
        courseType,
      },
    });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>← 뒤로</button>
        <h2 style={styles.title}>{course.course_info?.name || '러닝 코스'}</h2>
      </header>

      {/* Map */}
      <div style={styles.mapWrapper}>
        <MapContainer center={center} zoom={14} style={{ height: '400px', width: '100%', borderRadius: '16px' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={polyline} color={routeColor} weight={5} opacity={0.9} />
          {coords.length > 0 && (
            <Marker position={[coords[0].lat, coords[0].lng]} icon={startIcon}>
              <Popup>출발점</Popup>
            </Marker>
          )}
          {trafficLights.map((tl, i) => (
            <Marker key={`tl-${i}`} position={[tl.lat, tl.lng]} icon={trafficLightIcon}>
              <Popup>🚦 신호등 #{i + 1}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: '#00C853' }} />
          <span>출발점</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: '#FF4444' }} />
          <span>신호등</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendLine, background: routeColor }} />
          <span>러닝 코스</span>
        </div>
      </div>

      {/* Course Info */}
      <div style={styles.infoGrid}>
        <div style={styles.infoCard}>
          <span style={styles.infoLabel}>코스 거리</span>
          <span style={styles.infoValue}>{course.distance_km} km</span>
        </div>
        <div style={styles.infoCard}>
          <span style={styles.infoLabel}>목표 거리</span>
          <span style={styles.infoValue}>{targetDistance} km</span>
        </div>
        <div style={styles.infoCard}>
          <span style={styles.infoLabel}>예상 시간</span>
          <span style={styles.infoValue}>{formatDuration(course.estimated_duration_min)}</span>
        </div>
        <div style={styles.infoCard}>
          <span style={styles.infoLabel}>경로 위 신호등</span>
          <span style={{
            ...styles.infoValue,
            color: course.traffic_lights_count > 0 ? '#FF4444' : 'var(--primary)',
          }}>
            {course.traffic_lights_count} 개
          </span>
        </div>
      </div>

      <div style={styles.typeTag}>
        <span>{course.course_info?.icon} {course.course_info?.name}</span>
        <span style={styles.typeDesc}>{course.course_info?.description}</span>
      </div>

      {/* Actions */}
      <button onClick={handleStartRun} style={styles.startBtn}>
        ▶ 이 코스로 러닝 시작
      </button>
      <button onClick={() => navigate('/')} style={styles.regenBtn}>
        🔄 다시 생성하기
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
    alignItems: 'center',
    gap: '16px',
    padding: '20px 0',
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
  mapWrapper: {
    borderRadius: '16px',
    overflow: 'hidden',
    marginBottom: '12px',
    border: '1px solid var(--border)',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    marginBottom: '20px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '2px solid #fff',
  },
  legendLine: {
    width: '20px',
    height: '4px',
    borderRadius: '2px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '16px',
  },
  infoCard: {
    background: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    border: '1px solid var(--border)',
  },
  infoLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  infoValue: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  typeTag: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '14px 18px',
    marginBottom: '24px',
    border: '1px solid var(--border)',
    fontSize: '15px',
    fontWeight: '600',
  },
  typeDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '400',
  },
  startBtn: {
    width: '100%',
    padding: '18px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
    color: '#000',
    fontSize: '18px',
    fontWeight: '800',
    marginBottom: '12px',
  },
  regenBtn: {
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
