import React, { useRef, useState, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
// import segments from "./segments"; // Eliminar esta línea, ahora será dinámico
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [segmentType, setSegmentType] = useState(null); // Nuevo estado para la selección
  const [segments, setSegments] = useState([]); // Estado para los segmentos

  // Cargar dinámicamente el archivo de segmentos según la selección
  useEffect(() => {
    if (segmentType === "with-scenes") {
      import("./segments-with-scenes.js").then(mod => setSegments(mod.default));
    } else if (segmentType === "without-scenes") {
      import("./segments-without-scenes.js").then(mod => setSegments(mod.default));
    }
  }, [segmentType]);

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log("Archivo seleccionado:", file.name, "Tamaño:", file.size);
      const url = URL.createObjectURL(file);
      console.log("URL creada:", url);
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
    console.log("useEffect audioUrl triggered, audioUrl:", audioUrl);
    console.log("wavesurferRef.current:", wavesurferRef.current);
    
    if (audioUrl && !wavesurferRef.current) {
      console.log("Iniciando creación de WaveSurfer...");
      
      // Verificar que el contenedor existe
      const container = document.getElementById("waveform");
      console.log("Contenedor waveform encontrado:", container);
      
      if (!container) {
        console.error("No se encontró el contenedor #waveform");
        return;
      }

      const regionsPlugin = RegionsPlugin.create();
      const timelinePlugin = TimelinePlugin.create();
      
      console.log("Plugins creados:", { regionsPlugin, timelinePlugin });
      
      try {
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
          },
          minPxPerSec: 100 * zoomLevel
        });
        
        console.log("WaveSurfer creado exitosamente:", wavesurferRef.current);
      } catch (error) {
        console.error("Error al crear WaveSurfer:", error);
        return;
      }

      console.log("Cargando audio URL:", audioUrl);
      wavesurferRef.current.load(audioUrl);
      setWaveLoading(true);

      wavesurferRef.current.on('ready', () => {
        console.log("WaveSurfer está listo!");
        
        // Verificar que el plugin de timeline esté disponible
        console.log("Plugin timeline disponible:", timelinePlugin);
        console.log("Plugins de WaveSurfer:", wavesurferRef.current.plugins);
        
        // Verificar que el plugin de regiones esté disponible
        if (regionsPlugin) {
          console.log("Agregando regiones...");
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
          console.log("Regiones agregadas:", segments.length);
        }
        setWaveLoading(false);
      });

      wavesurferRef.current.on('error', (error) => {
        console.error("Error en WaveSurfer:", error);
        setWaveLoading(false);
      });

      wavesurferRef.current.on('loading', (progress) => {
        console.log("Cargando WaveSurfer:", progress * 100 + "%");
      });

      // Evento cuando el usuario hace clic en una región
      regionsPlugin.on('region-clicked', (region, e) => {
        console.log("Región clickeada:", region.id);
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
        console.log("Destruyendo WaveSurfer...");
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

  // Actualizar el zoom dinámicamente
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.options.minPxPerSec = 100 * zoomLevel;
      wavesurferRef.current.zoom(100 * zoomLevel);
    }
  }, [zoomLevel]);

  // Verificar que los contenedores del DOM estén disponibles
  useEffect(() => {
    console.log("Componente montado, verificando contenedores...");
    const waveformContainer = document.getElementById("waveform");
    const timelineContainer = document.getElementById("timeline");
    
    console.log("Contenedor waveform:", waveformContainer);
    console.log("Contenedor timeline:", timelineContainer);
    
    if (!waveformContainer) {
      console.warn("El contenedor #waveform no está disponible en el DOM");
    }
    if (!timelineContainer) {
      console.warn("El contenedor #timeline no está disponible en el DOM");
    }
  }, []);

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
      {/* Selección de tipo de segmentación antes de subir el video */}
      {!segmentType && !videoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em', margin: '2em 0' }}>
          <button onClick={() => setSegmentType("with-scenes")} className="vsp-segment-btn">Segmentación con escenas</button>
          <button onClick={() => setSegmentType("without-scenes")} className="vsp-segment-btn">Segmentación sin escenas</button>
        </div>
      )}
      {/* Input de video solo si ya se eligió el tipo de segmentación */}
      {!hideUpload && !videoUrl && segmentType && (
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
      {/* El resto del renderizado igual, pero usando 'segments' del estado */}
      {videoUrl && segments.length > 0 && (
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
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1em', margin: '0.7em 0 0.2em 0' }}>
            <button
              onClick={() => setZoomLevel(z => Math.max(0.1, z - 0.25))}
              title="Zoom Out"
              style={{
                background: 'rgba(30,41,59,0.7)',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                color: '#fff',
                transition: 'background 0.2s',
                fontSize: 20
              }}
              onMouseOver={e => e.currentTarget.style.background = '#7c3aed'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(30,41,59,0.7)'}
            >
              -
            </button>
            <button
              onClick={() => setZoomLevel(z => Math.min(5, z + 0.25))}
              title="Zoom In"
              style={{
                background: 'rgba(30,41,59,0.7)',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                color: '#fff',
                transition: 'background 0.2s',
                fontSize: 20
              }}
              onMouseOver={e => e.currentTarget.style.background = '#7c3aed'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(30,41,59,0.7)'}
            >
              +
            </button>
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