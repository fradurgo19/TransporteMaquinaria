import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getRouteData } from '../services/gpsService';

interface GPSRouteMapProps {
  overtimeTrackingId: string;
  onClose: () => void;
}

export const GPSRouteMap: React.FC<GPSRouteMapProps> = ({ overtimeTrackingId, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<any[]>([]);

  useEffect(() => {
    loadRouteData();
  }, [overtimeTrackingId]);

  const loadRouteData = async () => {
    try {
      setLoading(true);
      const data = await getRouteData(overtimeTrackingId);
      setRouteData(data);
      
      if (data.length > 0) {
        initializeMap(data);
      }
    } catch (err: any) {
      console.error('Error cargando ruta GPS:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = (data: any[]) => {
    if (!mapRef.current) return;

    // Limpiar contenido previo
    mapRef.current.innerHTML = '';

    // Crear mapa usando Leaflet (simplificado con Google Maps API)
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY`;
    script.async = true;
    script.onload = () => renderMap(data);
    document.head.appendChild(script);
  };

  const renderMap = (data: any[]) => {
    if (!mapRef.current || !window.google) return;

    // Centro del mapa (primer punto)
    const firstPoint = data[0];
    const center = { lat: parseFloat(firstPoint.lat), lng: parseFloat(firstPoint.lng) };

    // Crear mapa
    const map = new google.maps.Map(mapRef.current, {
      zoom: 8,
      center,
      mapTypeId: 'roadmap',
    });

    // Marcador de inicio (verde)
    const startPoint = data[0];
    new google.maps.Marker({
      position: { lat: parseFloat(startPoint.lat), lng: parseFloat(startPoint.lng) },
      map,
      title: 'Inicio',
      label: 'I',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });

    // Marcador de fin (rojo)
    const endPoint = data[data.length - 1];
    new google.maps.Marker({
      position: { lat: parseFloat(endPoint.lat), lng: parseFloat(endPoint.lng) },
      map,
      title: 'Fin',
      label: 'F',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });

    // Ruta (polyline)
    const path = data.map(point => ({
      lat: parseFloat(point.lat),
      lng: parseFloat(point.lng),
    }));

    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map,
    });

    // Ajustar zoom para ver toda la ruta
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Ruta GPS del Vehículo</h2>
            <p className="text-sm text-gray-600 mt-1">
              {routeData.length} puntos GPS registrados
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
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <p className="text-red-600 font-medium">Error: {error}</p>
              </div>
            </div>
          )}

          {!loading && !error && routeData.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <p className="text-gray-600">No hay datos GPS para mostrar</p>
              </div>
            </div>
          )}

          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Info Panel */}
        {routeData.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Inicio</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData[0]?.localizacion || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(routeData[0]?.fecha_gps).toLocaleString('es-CO')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fin</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData[routeData.length - 1]?.localizacion || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(routeData[routeData.length - 1]?.fecha_gps).toLocaleString('es-CO')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Vehículo</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData[0]?.movil || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Puntos</p>
                <p className="text-sm font-medium text-gray-900">
                  {routeData.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

