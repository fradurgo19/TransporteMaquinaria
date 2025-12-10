import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getRouteData } from '../services/gpsService';

interface GPSRouteMapProps {
  overtimeTrackingId: string;
  onClose: () => void;
}

// Variable global para rastrear si Leaflet ya está cargado
let leafletLoading = false;
let leafletLoadPromise: Promise<void> | null = null;

/**
 * Cargar Leaflet (gratuito, sin API key) de forma segura (solo una vez)
 */
const loadLeaflet = (): Promise<void> => {
  // Si ya está cargado, retornar promesa resuelta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as { L?: any }).L) {
    return Promise.resolve();
  }

  // Si ya está cargando, retornar la promesa existente
  if (leafletLoading && leafletLoadPromise) {
    return leafletLoadPromise;
  }

  // Si ya existe un script, esperar a que cargue
  const existingScript = document.querySelector('script[src*="leaflet"]');
  if (existingScript) {
    leafletLoading = true;
    leafletLoadPromise = new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as { L?: any }).L) {
          clearInterval(checkInterval);
          leafletLoading = false;
          resolve();
        }
      }, 100);

      // Timeout después de 10 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as { L?: any }).L) {
          leafletLoading = false;
          reject(new Error('Timeout cargando Leaflet'));
        }
      }, 10000);
    });
    return leafletLoadPromise;
  }

  // Crear nuevo script para cargar Leaflet
  leafletLoading = true;
  leafletLoadPromise = new Promise((resolve, reject) => {
    // Cargar CSS primero
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Cargar JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      leafletLoading = false;
      resolve();
    };
    
    script.onerror = () => {
      leafletLoading = false;
      leafletLoadPromise = null;
      reject(new Error('Error cargando Leaflet'));
    };
    
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
};

interface GPSPoint {
  lat: string | number;
  lng: string | number;
  fecha_gps: string;
  localizacion?: string;
  movil?: string;
}

interface RouteData {
  points: GPSPoint[];
  routeStart: {
    fecha_gps: string | null;
    localizacion: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  routeEnd: {
    fecha_gps: string | null;
    localizacion: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

export const GPSRouteMap: React.FC<GPSRouteMapProps> = ({ overtimeTrackingId, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  // Renderizar mapa usando Leaflet (gratuito, sin API key)
  const renderMap = React.useCallback((data: RouteData) => {
    if (!mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as { L?: any }).L;
    if (!L) {
      console.error('Leaflet no está disponible');
      setError('Error al cargar Leaflet. Los datos GPS están disponibles en la tabla de abajo.');
      return;
    }

    // Helper para convertir lat/lng a número
    const toNumber = (value: string | number | null): number => {
      if (value === null || value === undefined) return 0;
      return typeof value === 'string' ? parseFloat(value) : value;
    };

    const points = data.points;
    if (points.length === 0) {
      setError('No hay puntos GPS para mostrar');
      return;
    }

    // Determinar inicio y fin: usar los detectados por el algoritmo si están disponibles
    let startPoint: GPSPoint | null = null;
    let endPoint: GPSPoint | null = null;

    // Usar el punto de inicio detectado por el algoritmo (si tiene coordenadas)
    if (data.routeStart && data.routeStart.lat !== null && data.routeStart.lng !== null) {
      startPoint = {
        lat: data.routeStart.lat,
        lng: data.routeStart.lng,
        fecha_gps: data.routeStart.fecha_gps || '',
        localizacion: data.routeStart.localizacion || undefined,
        movil: points[0]?.movil,
      };
    } else if (data.routeStart?.fecha_gps) {
      // Si no tiene coordenadas, buscar el punto GPS más cercano al tiempo de inicio detectado
      const startTime = new Date(data.routeStart.fecha_gps).getTime();
      startPoint = points.reduce((closest, point) => {
        const pointTime = new Date(point.fecha_gps).getTime();
        const closestTime = closest ? new Date(closest.fecha_gps).getTime() : Infinity;
        return Math.abs(pointTime - startTime) < Math.abs(closestTime - startTime) ? point : closest;
      }, null as GPSPoint | null);
    }

    // Usar el punto de fin detectado por el algoritmo (si tiene coordenadas)
    if (data.routeEnd && data.routeEnd.lat !== null && data.routeEnd.lng !== null) {
      endPoint = {
        lat: data.routeEnd.lat,
        lng: data.routeEnd.lng,
        fecha_gps: data.routeEnd.fecha_gps || '',
        localizacion: data.routeEnd.localizacion || undefined,
        movil: points[0]?.movil,
      };
    } else if (data.routeEnd?.fecha_gps) {
      // Si no tiene coordenadas, buscar el punto GPS más cercano al tiempo de fin detectado
      const endTime = new Date(data.routeEnd.fecha_gps).getTime();
      endPoint = points.reduce((closest, point) => {
        const pointTime = new Date(point.fecha_gps).getTime();
        const closestTime = closest ? new Date(closest.fecha_gps).getTime() : Infinity;
        return Math.abs(pointTime - endTime) < Math.abs(closestTime - endTime) ? point : closest;
      }, null as GPSPoint | null);
    }

    // Fallback: usar primer y último punto si no se encontraron los detectados
    if (!startPoint) startPoint = points[0];
    if (!endPoint) endPoint = points[points.length - 1];

    // Centro del mapa (punto de inicio)
    const center: [number, number] = [
      toNumber(startPoint.lat),
      toNumber(startPoint.lng)
    ];

    // Crear mapa
    const map = L.map(mapRef.current).setView(center, 8);
    mapInstanceRef.current = map;

    // Agregar capa de OpenStreetMap (gratuita)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Marcador de inicio (verde) - usando el punto detectado por el algoritmo
    L.marker([toNumber(startPoint.lat), toNumber(startPoint.lng)], {
      icon: L.divIcon({
        className: 'custom-marker-start',
        html: '<div style="background-color: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">I</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map).bindPopup(`Inicio detectado<br>${data.routeStart?.localizacion || startPoint.localizacion || 'N/A'}`);

    // Marcador de fin (rojo) - usando el punto detectado por el algoritmo
    L.marker([toNumber(endPoint.lat), toNumber(endPoint.lng)], {
      icon: L.divIcon({
        className: 'custom-marker-end',
        html: '<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">F</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map).bindPopup(`Fin detectado<br>${data.routeEnd?.localizacion || endPoint.localizacion || 'N/A'}`);

    // Ruta (polyline) - todos los puntos
    const path = points.map(point => [
      toNumber(point.lat),
      toNumber(point.lng)
    ] as [number, number]);

    L.polyline(path, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1,
    }).addTo(map);

    // Ajustar zoom para ver toda la ruta
    const bounds = L.latLngBounds(path);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, []);

  const initializeMap = React.useCallback(async (data: RouteData) => {
    if (!mapRef.current) return;

    try {
      // Limpiar contenido previo
      mapRef.current.innerHTML = '';

      // Cargar Leaflet (gratuito, sin API key)
      await loadLeaflet();

      // Renderizar mapa
      renderMap(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al inicializar el mapa';
      console.error('Error inicializando mapa:', err);
      setError(errorMessage);
      throw err;
    }
  }, [renderMap]);

  useEffect(() => {
    let isMounted = true;
    const currentMapRef = mapRef.current;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🗺️ Cargando datos de ruta GPS...');
        const data = await getRouteData(overtimeTrackingId);
        
        if (isMounted) {
          console.log(`✅ Datos cargados: ${data.points.length} puntos GPS`);
          setRouteData(data);
          
          if (data.points.length > 0) {
            await initializeMap(data);
          } else {
            setError('No hay datos GPS para mostrar');
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          let errorMessage = 'Error al cargar la ruta GPS';
          
          if (err instanceof Error) {
            errorMessage = err.message;
            
            // Detectar errores de autenticación
            if (err.message.includes('JWT') || err.message.includes('token') || err.message.includes('session')) {
              errorMessage = 'Sesión expirada. Por favor, recarga la página e intenta nuevamente.';
              console.error('❌ Error de autenticación:', err);
            } else {
              console.error('❌ Error cargando ruta GPS:', err);
            }
          } else {
            console.error('❌ Error desconocido cargando ruta GPS:', err);
          }
          
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    
    // Cleanup: limpiar mapa al desmontar
    return () => {
      isMounted = false;
      if (currentMapRef) {
        currentMapRef.innerHTML = '';
      }
    };
  }, [overtimeTrackingId, initializeMap]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Ruta GPS del Vehículo</h2>
            <p className="text-sm text-gray-600 mt-1">
              {routeData?.points.length || 0} puntos GPS registrados
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando mapa...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-8">
              <div className="text-center max-w-2xl">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    ⚠️ Error al cargar el mapa
                  </h3>
                  <p className="text-sm text-red-800">
                    {error}
                  </p>
                </div>
                {routeData && routeData.points.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-900">
                      💡 <strong>Alternativa:</strong> Los datos GPS están disponibles en la tabla de abajo.
                      Puedes ver las coordenadas y ubicaciones de cada punto.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && !error && (!routeData || routeData.points.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <p className="text-gray-600">No hay datos GPS para mostrar</p>
              </div>
            </div>
          )}

          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Info Panel */}
        {routeData && routeData.points.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Inicio</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData.routeStart?.localizacion || routeData.points[0]?.localizacion || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  {routeData.routeStart?.fecha_gps 
                    ? new Date(routeData.routeStart.fecha_gps).toLocaleString('es-CO')
                    : routeData.points[0]?.fecha_gps 
                      ? new Date(routeData.points[0].fecha_gps).toLocaleString('es-CO')
                      : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fin</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData.routeEnd?.localizacion || routeData.points[routeData.points.length - 1]?.localizacion || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  {routeData.routeEnd?.fecha_gps 
                    ? new Date(routeData.routeEnd.fecha_gps).toLocaleString('es-CO')
                    : routeData.points[routeData.points.length - 1]?.fecha_gps 
                      ? new Date(routeData.points[routeData.points.length - 1].fecha_gps).toLocaleString('es-CO')
                      : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Vehículo</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData.points[0]?.movil || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Puntos</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData.points.length}
                </p>
              </div>
            </div>
            
            {/* Tabla de datos GPS (alternativa cuando no hay mapa) */}
            {error && routeData && routeData.points.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs text-gray-500 mb-2">Datos GPS disponibles (primeros 10 puntos):</p>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Fecha</th>
                        <th className="px-2 py-1 text-left">Ubicación</th>
                        <th className="px-2 py-1 text-left">Lat</th>
                        <th className="px-2 py-1 text-left">Lng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routeData.points.slice(0, 10).map((point, idx) => {
                        const lat = typeof point.lat === 'string' ? parseFloat(point.lat) : point.lat;
                        const lng = typeof point.lng === 'string' ? parseFloat(point.lng) : point.lng;
                        return (
                          <tr key={idx} className="border-b">
                            <td className="px-2 py-1">
                              {new Date(point.fecha_gps).toLocaleString('es-CO')}
                            </td>
                            <td className="px-2 py-1">{point.localizacion || 'N/A'}</td>
                            <td className="px-2 py-1">{lat.toFixed(6)}</td>
                            <td className="px-2 py-1">{lng.toFixed(6)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {routeData.points.length > 10 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ... y {routeData.points.length - 10} puntos más
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};



