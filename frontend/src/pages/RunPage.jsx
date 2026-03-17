import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import 'leaflet/dist/leaflet.css';

const runnerIcon = new L.DivIcon({
  html: '<div style="background:#00C853;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(0,200,83,0.8)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(distKm, seconds) {
  if (distKm <= 0) return "0'00\"";
  const paceSeconds = seconds / distKm;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.floor(paceSeconds % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
}

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo(position, { animate: true });
  }, [position, map]);
  return null;
}

export default function RunPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { plannedRoute, courseType } = location.state || {};

  const [status, setStatus] = useState('ready'); // ready, running, paused, finished
  const [runId, setRunId] = useState(null);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [currentPos, setCurrentPos] = useState(null);
  const [calories, setCalories] = useState(0);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastPosRef = useRef(null);
  const routeRef = useRef([]);
  const wakeLockRef = useRef(null);

  // 러닝 중 화면 꺼짐 방지
  useEffect(() => {
    const requestWakeLock = async () => {
      if (status === 'running' && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {}
      } else if (status !== 'running' && wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
    requestWakeLock();
    return () => { wakeLockRef.current?.release(); };
  }, [status]);

  // GPS tracking
  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
          accuracy: pos.coords.accuracy,
        };
        setCurrentPos([point.lat, point.lng]);

        if (lastPosRef.current) {
          const d = haversine(
            lastPosRef.current.lat, lastPosRef.current.lng,
            point.lat, point.lng
          );
          // Filter GPS noise - only count if moved > 3m and accuracy < 30m
          if (d > 0.003 && pos.coords.accuracy < 30) {
            setDistance((prev) => prev + d);
            setCalories((prev) => prev + d * 60); // ~60 cal per km
            routeRef.current = [...routeRef.current, point];
            setRoute([...routeRef.current]);
            lastPosRef.current = point;
          }
        } else {
          lastPosRef.current = point;
          routeRef.current = [point];
          setRoute([point]);
        }
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Timer
  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Get initial position
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => stopTracking();
  }, [stopTracking]);

  const handleStart = async () => {
    try {
      const res = await api.post('/runs/start', {
        course_type: courseType || 'free',
        planned_route: plannedRoute || null,
      });
      setRunId(res.data.run_id);
      setStatus('running');
      startTracking();
    } catch {
      alert('러닝 시작에 실패했습니다');
    }
  };

  const handlePause = () => {
    setStatus('paused');
    stopTracking();
  };

  const handleResume = () => {
    setStatus('running');
    startTracking();
  };

  const handleFinish = async () => {
    stopTracking();
    setStatus('finished');

    if (runId) {
      const avgPace = distance > 0 ? elapsed / 60 / distance : 0;
      try {
        await api.put(`/runs/${runId}/finish`, {
          route: routeRef.current,
          distance_km: Math.round(distance * 100) / 100,
          duration_seconds: elapsed,
          avg_pace: Math.round(avgPace * 100) / 100,
          calories: Math.round(calories),
          elevation_gain: 0,
        });
      } catch {
        console.error('Failed to save run');
      }
    }
  };

  // Periodic save while running
  useEffect(() => {
    if (status !== 'running' || !runId) return;
    const saveInterval = setInterval(() => {
      api.put(`/runs/${runId}/update`, {
        route: routeRef.current,
        distance_km: Math.round(distance * 100) / 100,
        duration_seconds: elapsed,
        status: 'in_progress',
      }).catch(() => {});
    }, 30000); // Save every 30 seconds
    return () => clearInterval(saveInterval);
  }, [status, runId, distance, elapsed]);

  const plannedPolyline = plannedRoute?.map((c) => [c.lat, c.lng]) || [];
  const runPolyline = route.map((p) => [p.lat, p.lng]);
  const mapCenter = currentPos || [37.5665, 126.978];

  return (
    <div style={styles.container}>
      {/* Map */}
      <div style={styles.mapWrapper}>
        <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater position={currentPos} />
          {plannedPolyline.length > 0 && (
            <Polyline positions={plannedPolyline} color="#555" weight={4} dashArray="10,10" opacity={0.6} />
          )}
          {runPolyline.length > 1 && (
            <Polyline positions={runPolyline} color="#00C853" weight={5} opacity={0.9} />
          )}
          {currentPos && <Marker position={currentPos} icon={runnerIcon} />}
        </MapContainer>
      </div>

      {/* Stats Dashboard */}
      <div style={styles.dashboard}>
        <div style={styles.mainStat}>
          <span style={styles.mainStatValue}>{distance.toFixed(2)}</span>
          <span style={styles.mainStatUnit}>km</span>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{formatTime(elapsed)}</span>
            <span style={styles.statLabel}>시간</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{formatPace(distance, elapsed)}</span>
            <span style={styles.statLabel}>페이스</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{Math.round(calories)}</span>
            <span style={styles.statLabel}>kcal</span>
          </div>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          {status === 'ready' && (
            <button onClick={handleStart} style={styles.startBtn}>
              ▶ 러닝 시작
            </button>
          )}
          {status === 'running' && (
            <>
              <button onClick={handlePause} style={styles.pauseBtn}>⏸ 일시정지</button>
              <button onClick={handleFinish} style={styles.stopBtn}>⏹ 종료</button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button onClick={handleResume} style={styles.resumeBtn}>▶ 계속</button>
              <button onClick={handleFinish} style={styles.stopBtn}>⏹ 종료</button>
            </>
          )}
          {status === 'finished' && (
            <div style={styles.finishMsg}>
              <h3 style={styles.finishTitle}>러닝 완료! 🎉</h3>
              <p style={styles.finishSub}>
                {distance.toFixed(2)}km를 {formatTime(elapsed)}에 완주했습니다
              </p>
              <div style={styles.finishBtns}>
                <button onClick={() => navigate('/history')} style={styles.historyBtn}>기록 보기</button>
                <button onClick={() => navigate('/')} style={styles.homeBtn}>홈으로</button>
              </div>
            </div>
          )}
        </div>

        {status !== 'finished' && (
          <button onClick={() => navigate('/')} style={styles.backBtn}>← 홈으로</button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg)',
  },
  mapWrapper: {
    flex: 1,
    minHeight: 0,
  },
  dashboard: {
    padding: '24px 20px',
    paddingBottom: '36px',
    background: 'var(--bg-card)',
    borderRadius: '24px 24px 0 0',
    marginTop: '-24px',
    position: 'relative',
    zIndex: 1000,
  },
  mainStat: {
    textAlign: 'center',
    marginBottom: '16px',
  },
  mainStatValue: {
    fontSize: '56px',
    fontWeight: '900',
    color: 'var(--primary)',
    letterSpacing: '-2px',
  },
  mainStatUnit: {
    fontSize: '20px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginLeft: '4px',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '24px',
    padding: '16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  startBtn: {
    flex: 1,
    padding: '18px',
    borderRadius: '16px',
    border: 'none',
    background: 'var(--primary)',
    color: '#000',
    fontSize: '20px',
    fontWeight: '800',
  },
  pauseBtn: {
    flex: 1,
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: 'var(--warning)',
    color: '#000',
    fontSize: '16px',
    fontWeight: '700',
  },
  resumeBtn: {
    flex: 1,
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: 'var(--primary)',
    color: '#000',
    fontSize: '16px',
    fontWeight: '700',
  },
  stopBtn: {
    padding: '16px 24px',
    borderRadius: '16px',
    border: 'none',
    background: 'var(--danger)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
  },
  finishMsg: {
    textAlign: 'center',
  },
  finishTitle: {
    fontSize: '24px',
    fontWeight: '800',
    marginBottom: '8px',
  },
  finishSub: {
    color: 'var(--text-secondary)',
    marginBottom: '20px',
  },
  finishBtns: {
    display: 'flex',
    gap: '12px',
  },
  historyBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--primary)',
    color: '#000',
    fontSize: '15px',
    fontWeight: '700',
  },
  homeBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: '12px',
    border: '2px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '15px',
    fontWeight: '600',
  },
  backBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
};
