import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
  isPermissionGranted: boolean;
}

export const useGeolocation = (watch: boolean = false) => {
  const [location, setLocation] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: true,
    isPermissionGranted: false,
  });

  const getCurrentPosition = () => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: 'Geolocalización no soportada en este navegador',
        isLoading: false,
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          isLoading: false,
          isPermissionGranted: true,
        });
        
        // Guardar en localStorage para persistencia
        localStorage.setItem('lastKnownLocation', JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        }));
      },
      (error) => {
        let errorMessage = 'Error obteniendo ubicación';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado';
            break;
        }

        setLocation(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          isPermissionGranted: false,
        }));

        // Intentar cargar última ubicación conocida
        const saved = localStorage.getItem('lastKnownLocation');
        if (saved) {
          try {
            const { latitude, longitude } = JSON.parse(saved);
            setLocation(prev => ({
              ...prev,
              latitude,
              longitude,
              error: errorMessage + ' (usando última ubicación conocida)',
            }));
          } catch (e) {
            console.error('Error loading saved location:', e);
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    getCurrentPosition();

    if (watch) {
      const watchId = navigator.geolocation?.watchPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            error: null,
            isLoading: false,
            isPermissionGranted: true,
          });
        },
        (error) => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );

      return () => {
        if (watchId !== undefined) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    }
  }, [watch]);

  return {
    ...location,
    refresh: getCurrentPosition,
  };
};

