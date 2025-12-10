/**
 * Servicio de geocodificación inversa usando OpenStreetMap Nominatim (gratuito)
 * Convierte coordenadas GPS en direcciones legibles
 */

export interface GeocodingResult {
  address: string;
  displayName: string;
  error?: string;
}

/**
 * Obtener dirección desde coordenadas GPS usando OpenStreetMap Nominatim
 * @param lat Latitud
 * @param lng Longitud
 * @returns Dirección formateada o null si hay error
 */
export const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<GeocodingResult> => {
  try {
    // Usar Nominatim API de OpenStreetMap (gratuito, requiere rate limiting)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TransporteMaquinaria/1.0', // Requerido por Nominatim
      },
    });

    if (!response.ok) {
      throw new Error(`Error en geocodificación: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.address) {
      return {
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        displayName: 'Ubicación no identificada',
      };
    }

    // Construir dirección legible
    const addr = data.address;
    const parts: string[] = [];

    // Priorizar: road, suburb, city, state, country
    if (addr.road) parts.push(addr.road);
    if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
    if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);

    const address = parts.length > 0 
      ? parts.join(', ')
      : data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    return {
      address,
      displayName: data.display_name || address,
    };
  } catch (error: any) {
    console.warn('⚠️ Error en geocodificación inversa:', error);
    // Retornar coordenadas como fallback
    return {
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      displayName: `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      error: error.message,
    };
  }
};

