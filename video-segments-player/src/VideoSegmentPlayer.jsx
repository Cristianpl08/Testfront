import React, { useRef, useState, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import segments from "./segments";
import "./App.css";
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';

function VideoSegmentPlayer({ hideUpload }) {
  const videoRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0);
  const [waveLoading, setWaveLoading] = useState(false);
  const [isUserSeeking, setIsUserSeeking] = useState(false);

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setAudioUrl(url);
      setWaveLoading(true);
    }
  };

  // Función para sincronizar video con WaveSurfer
  const syncVideoToWaveform = (progress) => {
    if (videoRef.current && videoRef.current.duration) {
      const newTime = progress * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
    }
  };

  // Función para sincronizar WaveSurfer con video
  const syncWaveformToVideo = () => {
    if (videoRef.current && wavesurferRef.current && videoRef.current.duration) {
      const progress = videoRef.current.currentTime / videoRef.current.duration;
      wavesurferRef.current.seekTo(progress);
    }
  };

  useEffect(() => {
    if (audioUrl && !wavesurferRef.current) {
      const regionsPlugin = RegionsPlugin.create();
      const timelinePlugin = TimelinePlugin.create();
      
      wavesurferRef.current = WaveSurfer.create({
        container: "#waveform",
        waveColor: "#ddd",
        progressColor: "#2196f3",
        height: 80,
        responsive: true,
        backend: "WebAudio",
        plugins: [regionsPlugin, timelinePlugin],
        timeline: {
          container: "#timeline"
        }
      });

      wavesurferRef.current.load(audioUrl);
      setWaveLoading(true);

      wavesurferRef.current.on('ready', () => {
        // Verificar que el plugin de regiones esté disponible
        if (regionsPlugin) {
          regionsPlugin.clearRegions();
          segments.forEach((seg, idx) => {
            regionsPlugin.addRegion({
              id: String(seg.id),
              start: seg.start,
              end: seg.end,
              color: idx === currentSegmentIdx ? 'rgba(124,58,237,0.3)' : 'rgba(96,165,250,0.2)',
              drag: false,
              resize: false,
            });
          });
        }
        setWaveLoading(false);
      });

      // Evento cuando el usuario hace clic en una región
      regionsPlugin.on('region-clicked', (region, e) => {
        e.stopPropagation();
        const segmentId = Number(region.id);
        const segment = segments.find(seg => seg.id === segmentId);
        if (segment) {
          setIsUserSeeking(true);
          syncVideoToWaveform(segment.start / (videoRef.current?.duration || 1));
          setCurrentSegmentIdx(segments.findIndex(seg => seg.id === segmentId));
          setTimeout(() => setIsUserSeeking(false), 200);
        }
      });

      // Evento cuando el usuario hace clic en el WaveSurfer
      wavesurferRef.current.on('seek', (progress) => {
        if (!isUserSeeking) {
          setIsUserSeeking(true);
          syncVideoToWaveform(progress);
          setTimeout(() => setIsUserSeeking(false), 200);
        }
      });

      // Evento de proceso de audio para detectar segmentos
      wavesurferRef.current.on('audioprocess', (time) => {
        if (!isUserSeeking) {
          const idx = segments.findIndex(seg => time >= seg.start && time <= seg.end);
          if (idx !== -1 && idx !== currentSegmentIdx) {
            setCurrentSegmentIdx(idx);
          }
        }
      });
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]);

  // Sincronizar video con WaveSurfer cuando el video se reproduce
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wavesurferRef.current) return;

    const handleTimeUpdate = () => {
      if (!isUserSeeking && video.duration) {
        syncWaveformToVideo();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isUserSeeking]);

  // Actualizar colores de regiones cuando cambia el segmento actual
  useEffect(() => {
    if (wavesurferRef.current) {
      // En WaveSurfer v7, los plugins se acceden directamente
      const regionsPlugin = wavesurferRef.current.plugins.regions;
      if (regionsPlugin) {
        segments.forEach((seg, idx) => {
          const region = regionsPlugin.getRegions().find(r => r.id === String(seg.id));
          if (region) {
            region.update({ 
              color: idx === currentSegmentIdx ? 'rgba(124,58,237,0.3)' : 'rgba(96,165,250,0.2)' 
            });
          }
        });
      }
    }
  }, [currentSegmentIdx]);

  const goToSegment = (start) => {
    if (videoRef.current && wavesurferRef.current) {
      setIsUserSeeking(true);
      videoRef.current.currentTime = start;
      videoRef.current.play();
      
      if (videoRef.current.duration) {
        const progress = start / videoRef.current.duration;
        wavesurferRef.current.seekTo(progress);
      }
      
      setTimeout(() => setIsUserSeeking(false), 200);
    }
  };

  const goToPrevSegment = () => {
    if (currentSegmentIdx > 0) {
      const newIdx = currentSegmentIdx - 1;
      setCurrentSegmentIdx(newIdx);
      goToSegment(segments[newIdx].start);
    }
  };

  const goToNextSegment = () => {
    if (currentSegmentIdx < segments.length - 1) {
      const newIdx = currentSegmentIdx + 1;
      setCurrentSegmentIdx(newIdx);
      goToSegment(segments[newIdx].start);
    }
  };

  return (
    <div className="vsp-bg">
      {waveLoading && (
        <div className="vsp-loading-overlay">
          <div>
            <div className="vsp-spinner"></div>
            Cargando onda de audio...
          </div>
        </div>
      )}
      {!hideUpload && (
        <label className="vsp-upload-label">
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="vsp-upload-input"
          />
          Seleccionar video
        </label>
      )}
      {videoUrl && (
        <div style={{ width: "100%" }}>
          <video
            ref={videoRef}
            src={videoUrl}
            className="vsp-video"
            controls
          />
          <div className="vsp-waveform-container">
            <div id="waveform" className="vsp-waveform" />
            <div id="timeline" className="vsp-timeline" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1em', marginBottom: '1em' }}>
            <button onClick={goToPrevSegment} disabled={currentSegmentIdx === 0} className="vsp-segment-btn">Anterior</button>
            <button onClick={goToNextSegment} disabled={currentSegmentIdx === segments.length - 1} className="vsp-segment-btn">Siguiente</button>
          </div>
          <div className="vsp-segments">
            {segments.map((seg, idx) => (
              <button
                key={seg.id}
                onClick={() => { setCurrentSegmentIdx(idx); goToSegment(seg.start); }}
                className="vsp-segment-btn"
                style={idx === currentSegmentIdx ? { border: '2px solid #7c3aed', background: 'linear-gradient(90deg, #7c3aed 60%, #60a5fa 100%)' } : {}}
              >
                #{seg.id} ({seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoSegmentPlayer;