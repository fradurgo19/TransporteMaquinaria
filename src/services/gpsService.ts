import { supabase } from './supabase';
import * as XLSX from 'xlsx';

declare const google: any;

export interface GPSRecord {
  movil: string;
  alias: string;
  fecha_gps: string; // Formato: "2025/07/01 06:47:57"
  fecha_servidor: string;
  localizacion: string;
  mensaje: string;
  lat: number;
  lng: number;
}

export interface GPSAnalysisResult {
  entrada: string | null;
  salida: string | null;
  ubicacion_entrada: string | null;
  ubicacion_salida: string | null;
  lat_entrada: number | null;
  lng_entrada: number | null;
  lat_salida: number | null;
  lng_salida: number | null;
  total_records: number;
}

/**
 * Normalizar nombre de columna (elimina espacios, tildes, mayúsculas)
 */
const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
    .replace(/\s+/g, '') // Eliminar espacios
    .trim();
};

/**
 * Mapear columnas flexibles del Excel
 */
const mapExcelColumns = (row: any): GPSRecord | null => {
  const keys = Object.keys(row);
  const normalizedRow: any = {};
  
  // Normalizar todas las claves
  keys.forEach(key => {
    const normalized = normalizeColumnName(key);
    normalizedRow[normalized] = row[key];
  });
  
  // Mapeo flexible de columnas (soporta múltiples variantes)
  const getColumn = (variants: string[]): any => {
    for (const variant of variants) {
      const normalized = normalizeColumnName(variant);
      if (normalizedRow[normalized] !== undefined) {
        return normalizedRow[normalized];
      }
    }
    return null;
  };
  
  // Función helper para convertir valores a string, manejando Date objects
  const toStringSafe = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) {
      // Convertir Date a formato "YYYY/MM/DD HH:mm:ss" para mantener consistencia
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }
    return String(value).trim();
  };

  try {
    const record: GPSRecord = {
      movil: toStringSafe(getColumn(['Movil', 'Móvil', 'Placa', 'Vehiculo', 'Vehículo'])),
      alias: toStringSafe(getColumn(['Alias', 'Nombre', 'Empresa', 'Cliente'])),
      fecha_gps: toStringSafe(getColumn(['Fecha GPS', 'FechaGPS', 'Fecha', 'Date GPS', 'GPS Date'])),
      fecha_servidor: toStringSafe(getColumn(['Fecha Servidor', 'FechaServidor', 'Server Date', 'Fecha Server'])),
      localizacion: toStringSafe(getColumn(['Localizacion', 'Localización', 'Ubicacion', 'Ubicación', 'Location', 'Lugar'])),
      mensaje: toStringSafe(getColumn(['Mensaje', 'Message', 'Estado', 'Status', 'Evento', 'Event'])),
      lat: parseFloat(getColumn(['Lat', 'Latitud', 'Latitude']) || '0'),
      lng: parseFloat(getColumn(['Lng', 'Long', 'Lon', 'Longitud', 'Longitude']) || '0'),
    };
    
    // Validar que tenga datos mínimos
    if (!record.movil || !record.fecha_gps || record.lat === 0 || record.lng === 0) {
      return null;
    }
    
    return record;
  } catch (error) {
    console.warn('⚠️ Error mapeando fila:', error);
    return null;
  }
};

/**
 * Parsear archivo Excel del proveedor GPS
 * Columnas: Movil | Alias | Fecha GPS | Fecha Servidor | Localizacion | Mensaje | Lat | Lng
 * Soporta diferentes versiones de Excel y orden de columnas
 */
export const parseGPSExcel = (file: File): Promise<GPSRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        // Soportar diferentes formatos de Excel
        let workbook: any;
        try {
          workbook = XLSX.read(data, { type: 'binary', cellDates: true, dateNF: 'yyyy/mm/dd hh:mm:ss' });
        } catch {
          // Intentar con array buffer si falla binary
          workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy/mm/dd hh:mm:ss' });
        }
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON con headers
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { 
          header: 'A', // Usar headers automáticos primero
          defval: '',
          blankrows: false
        });
        
        // Si la primera fila parece ser header, usar esos nombres
        const firstRow = jsonData[0];
        const hasHeaders = Object.values(firstRow).some((val: any) => 
          typeof val === 'string' && 
          (val.toLowerCase().includes('movil') || 
           val.toLowerCase().includes('placa') ||
           val.toLowerCase().includes('fecha') ||
           val.toLowerCase().includes('lat'))
        );
        
        let dataRows: any[];
        if (hasHeaders) {
          // Re-parsear usando la primera fila como headers
          dataRows = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '',
            blankrows: false
          });
        } else {
          dataRows = jsonData;
        }
        
        console.log('📊 Excel parseado:', dataRows.length, 'registros');
        console.log('📋 Primera fila (muestra):', dataRows[0]);
        
        // Mapear con flexibilidad
        const records: GPSRecord[] = dataRows
          .map(row => mapExcelColumns(row))
          .filter((r): r is GPSRecord => r !== null);
        
        if (records.length === 0) {
          reject(new Error('No se encontraron registros válidos en el Excel.\n\nVerifica que el archivo contenga las columnas: Movil, Fecha GPS, Lat, Lng'));
          return;
        }
        
        console.log(`✅ ${records.length} registros válidos procesados`);
        console.log('📋 Primer registro:', records[0]);
        
        resolve(records);
      } catch (error: any) {
        console.error('❌ Error parseando Excel:', error);
        reject(new Error(`Error leyendo Excel: ${error.message}\n\nVerifica que sea un archivo .xlsx o .xls válido`));
      }
    };
    
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    
    // Intentar leer como binary primero, luego como array buffer
    try {
      reader.readAsBinaryString(file);
    } catch {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Convertir fecha del formato del proveedor a ISO
 * Formato entrada: "2025/07/01 06:47:57"
 */
export const parseGPSDate = (dateStr: string): string => {
  try {
    // Formato: "2025/07/01 06:47:57" -> "2025-07-01T06:47:57"
    const [date, time] = dateStr.split(' ');
    const [year, month, day] = date.split('/');
    return `${year}-${month}-${day}T${time}`;
  } catch (error) {
    console.error('Error parseando fecha GPS:', dateStr);
    return dateStr;
  }
};

/**
 * Verificar si un mensaje indica que el móvil está encendido
 * Soporta diferentes formatos: "Movil Encendido", "Movil  Encendido", "Reporte por tiempo (Movil Encendido)", etc.
 */
const isMovilEncendido = (mensaje: string): boolean => {
  const mensajeUpper = mensaje.toUpperCase();
  return mensajeUpper.includes('MOVIL') && mensajeUpper.includes('ENCENDIDO');
};

/**
 * Verificar si un mensaje indica que el móvil está apagado
 * Soporta diferentes formatos: "Movil Apagado", "Movil  Apagado", "Reporte por tiempo (Movil Apagado)", etc.
 */
const isMovilApagado = (mensaje: string): boolean => {
  const mensajeUpper = mensaje.toUpperCase();
  return mensajeUpper.includes('MOVIL') && mensajeUpper.includes('APAGADO');
};

/**
 * Calcular distancia entre dos coordenadas (aproximada en grados)
 * 0.001 grados ≈ 111 metros
 */
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lng1 - lng2);
  // Distancia aproximada en grados (no es exacta pero suficiente para comparar)
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
};

/**
 * Verificar si hay un cambio significativo en la localización
 * Considera tanto coordenadas como texto de localización
 */
const hasSignificantLocationChange = (
  startRecord: GPSRecord,
  currentRecord: GPSRecord,
  minDistance: number = 0.002 // Aprox 200 metros
): boolean => {
  // Cambio en coordenadas
  const distance = calculateDistance(
    startRecord.lat,
    startRecord.lng,
    currentRecord.lat,
    currentRecord.lng
  );
  
  // Cambio en el texto de localización (más confiable)
  const startLocation = (startRecord.localizacion || '').trim().toUpperCase();
  const currentLocation = (currentRecord.localizacion || '').trim().toUpperCase();
  const locationChanged = startLocation !== currentLocation && currentLocation.length > 0;
  
  // Si cambió el texto de localización, es un cambio significativo
  if (locationChanged) {
    console.log(`📍 Cambio de localización detectado: "${startLocation}" → "${currentLocation}"`);
    return true;
  }
  
  // Si no cambió el texto pero hay movimiento significativo de coordenadas
  if (distance > minDistance) {
    console.log(`📍 Movimiento significativo detectado: ${(distance * 111000).toFixed(0)} metros`);
    return true;
  }
  
  return false;
};

/**
 * Algoritmo inteligente para detectar inicio real del recorrido
 * Condiciones:
 * 1. Buscar "Movil Encendido" (en cualquier formato)
 * 2. Verificar que se mueva significativamente de la localización inicial
 *    - Cambio en el texto de localización (más confiable)
 *    - O movimiento de coordenadas > 200 metros
 * 3. Ignorar movimientos pequeños (solo para parquear)
 */
export const detectRouteStart = (records: GPSRecord[]): GPSRecord | null => {
  console.log('🔍 Detectando inicio del recorrido...');
  
  if (records.length === 0) {
    console.log('❌ No hay registros para analizar');
    return null;
  }
  
  // Buscar todos los encendidos
  const encendidos: { index: number; record: GPSRecord }[] = [];
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (isMovilEncendido(record.mensaje)) {
      encendidos.push({ index: i, record });
      console.log(`🔌 Encendido encontrado en ${record.fecha_gps} - Localización: ${record.localizacion}`);
    }
  }
  
  // Para cada encendido, verificar si hay un cambio significativo de localización
  for (const { index, record: encendidoRecord } of encendidos) {
    const startLat = encendidoRecord.lat;
    const startLng = encendidoRecord.lng;
    const startLocation = encendidoRecord.localizacion;
    
    console.log(`🔍 Analizando encendido en ${encendidoRecord.fecha_gps}...`);
    
    // Revisar los siguientes registros (hasta 30 registros o 1.5 horas)
    const maxRecordsToCheck = Math.min(30, records.length - index - 1);
    
    for (let j = index + 1; j < index + 1 + maxRecordsToCheck && j < records.length; j++) {
      const currentRecord = records[j];
      
      // Verificar cambio significativo de localización
      if (hasSignificantLocationChange(encendidoRecord, currentRecord)) {
        // Encontrar el primer registro después del encendido que muestra el cambio
        // Este es el inicio real del recorrido
        console.log(`✅ Inicio real del recorrido detectado:`);
        console.log(`   - Encendido: ${encendidoRecord.fecha_gps} en ${encendidoRecord.localizacion}`);
        console.log(`   - Movimiento detectado: ${currentRecord.fecha_gps} en ${currentRecord.localizacion}`);
        
        // Retornar el registro donde se detectó el cambio (inicio del recorrido real)
        return currentRecord;
      }
      
      // Si se apaga antes de moverse, este no es el inicio real
      if (isMovilApagado(currentRecord.mensaje)) {
        console.log(`⚠️ Se apagó antes de moverse, buscando siguiente encendido...`);
        break;
      }
    }
  }
  
  // Si no se encontró "Movil Encendido", buscar el primer movimiento significativo
  console.log('⚠️ No se encontró encendido con movimiento significativo, buscando primer movimiento...');
  
  if (records.length < 2) {
    console.log('⚠️ Usando primer registro como inicio');
    return records[0];
  }
  
  // Buscar el primer cambio significativo de localización
  const firstRecord = records[0];
  
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    
    if (hasSignificantLocationChange(firstRecord, record)) {
      console.log(`✅ Primer movimiento significativo detectado: ${record.fecha_gps} en ${record.localizacion}`);
      return record;
    }
  }
  
  // Si no hay movimiento, usar el primer registro
  console.log('⚠️ No se detectó movimiento significativo, usando primer registro como inicio');
  return records[0];
};

/**
 * Algoritmo inteligente para detectar fin real del recorrido
 * Condiciones:
 * 1. Buscar cuando el móvil cambia de encendido a apagado
 * 2. Verificar que después del apagado, permanezca en el mismo lugar por varios reportes
 * 3. El fin del recorrido es el momento del apagado (no los reportes posteriores)
 * 4. Debe haber al menos 2 reportes más después del apagado en el mismo lugar para confirmar
 */
export const detectRouteEnd = (records: GPSRecord[]): GPSRecord | null => {
  console.log('🔍 Detectando fin del recorrido...');
  
  if (records.length === 0) {
    console.log('❌ No hay registros para analizar');
    return null;
  }
  
  // Buscar todos los apagados y verificar que vengan de estar encendido
  const apagados: { index: number; record: GPSRecord; wasEncendido: boolean }[] = [];
  
  // Primero, identificar todos los apagados y verificar si venían de estar encendido
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    if (isMovilApagado(record.mensaje)) {
      // Verificar si el registro anterior estaba encendido
      let wasEncendido = false;
      
      // Buscar hacia atrás para encontrar el último estado encendido
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prevRecord = records[j];
        
        if (isMovilEncendido(prevRecord.mensaje)) {
          wasEncendido = true;
            break;
          }
        
        // Si encontramos otro apagado antes, no venía de estar encendido
        if (isMovilApagado(prevRecord.mensaje)) {
          break;
        }
      }
      
      apagados.push({ index: i, record, wasEncendido });
      console.log(`🛑 Apagado encontrado en ${record.fecha_gps} - Venía de encendido: ${wasEncendido}`);
    }
  }
  
  // Buscar el apagado que viene de estar encendido y permanece en el mismo lugar
  for (const { index, record: apagadoRecord, wasEncendido } of apagados) {
    // Solo considerar apagados que vienen de estar encendido
    if (!wasEncendido) {
      continue;
    }
    
    const apagadoLat = apagadoRecord.lat;
    const apagadoLng = apagadoRecord.lng;
    const apagadoLocation = apagadoRecord.localizacion;
    
    console.log(`🔍 Analizando apagado en ${apagadoRecord.fecha_gps} en ${apagadoLocation}...`);
    
    // Verificar que después del apagado, permanezca en el mismo lugar
    let stayedInSamePlace = true;
    let apagadoReportsCount = 0;
    const minReportsToConfirm = 2; // Mínimo 2 reportes más para confirmar fin del recorrido
    
    // Revisar los siguientes registros después del apagado (hasta 10 reportes o 1 hora)
    const maxRecordsToCheck = Math.min(10, records.length - index - 1);
    
    for (let j = index + 1; j < index + 1 + maxRecordsToCheck && j < records.length; j++) {
      const nextRecord = records[j];
      
      // Si se vuelve a encender, este no es el fin del recorrido
      if (isMovilEncendido(nextRecord.mensaje)) {
        console.log(`⚠️ Se volvió a encender después del apagado, este no es el fin del recorrido`);
        stayedInSamePlace = false;
        break;
      }
      
      // Si sigue apagado, verificar que esté en el mismo lugar
      if (isMovilApagado(nextRecord.mensaje)) {
        apagadoReportsCount++;
        
        // Verificar que no se haya movido significativamente
        const distance = calculateDistance(
          apagadoLat,
          apagadoLng,
          nextRecord.lat,
          nextRecord.lng
        );
        
        // Cambio en el texto de localización
        const locationChanged = (apagadoLocation || '').trim().toUpperCase() !== 
                                (nextRecord.localizacion || '').trim().toUpperCase();
        
        // Si se movió significativamente o cambió de localización, no es el fin
        if (distance > 0.001 || locationChanged) {
          console.log(`⚠️ Se movió después del apagado (distancia: ${(distance * 111000).toFixed(0)}m), este no es el fin`);
          stayedInSamePlace = false;
          break;
        }
      }
    }
    
    // Si permaneció en el mismo lugar con al menos 2 reportes más, es el fin del recorrido
    if (stayedInSamePlace && apagadoReportsCount >= minReportsToConfirm) {
      console.log(`✅ Fin real del recorrido detectado:`);
      console.log(`   - Apagado: ${apagadoRecord.fecha_gps} en ${apagadoLocation}`);
      console.log(`   - Confirmado con ${apagadoReportsCount} reportes adicionales en el mismo lugar`);
      return apagadoRecord;
    }
    
    // Si es el último registro y venía de estar encendido, también puede ser el fin
    if (index === records.length - 1 && wasEncendido) {
      console.log(`✅ Fin del recorrido (último registro): ${apagadoRecord.fecha_gps} en ${apagadoLocation}`);
      return apagadoRecord;
    }
  }
  
  // Si no se encontró un apagado válido, buscar el último registro encendido
  console.log('⚠️ No se encontró apagado válido, buscando último registro encendido...');
  
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    if (isMovilEncendido(record.mensaje)) {
      console.log(`⚠️ Usando último registro encendido como fin: ${record.fecha_gps}`);
      return record;
    }
  }
  
  // Si no hay nada, usar el último registro
  console.log('⚠️ Usando último registro como fin del recorrido');
  return records[records.length - 1];
};

/**
 * Validar que el Excel coincida con el registro de overtime
 */
export const validateGPSExcel = async (
  overtimeTrackingId: string,
  records: GPSRecord[]
): Promise<{ valid: boolean; message: string }> => {
  console.log('🔍 Validando coincidencia de Excel con registro...');
  
  // Obtener registro de overtime
  const { data: overtimeRecord, error } = await supabase
    .from('overtime_tracking')
    .select('placa, fecha')
    .eq('id', overtimeTrackingId)
    .single();
  
  if (error || !overtimeRecord) {
    return { valid: false, message: 'No se encontró el registro de overtime' };
  }
  
  const expectedPlaca = overtimeRecord.placa.toUpperCase().trim();
  const expectedDate = new Date(overtimeRecord.fecha).toISOString().split('T')[0]; // YYYY-MM-DD
  
  console.log(`📋 Registro: Placa=${expectedPlaca}, Fecha=${expectedDate}`);
  
  if (records.length === 0) {
    return { valid: false, message: 'El archivo Excel está vacío o no tiene datos válidos' };
  }
  
  // Obtener todas las placas únicas del Excel
  const placasEnExcel = [...new Set(records.map(r => r.movil.toUpperCase().trim()))];
  console.log(`📋 Placas encontradas en Excel: ${placasEnExcel.join(', ')}`);
  
  // Verificar que la placa esperada esté en el Excel
  const placaEncontrada = placasEnExcel.find(p => p === expectedPlaca);
  
  if (!placaEncontrada) {
    return { 
      valid: false, 
      message: `❌ Placa incorrecta\n\nRegistro esperado: ${expectedPlaca}\nPlacas en Excel: ${placasEnExcel.join(', ')}\n\nEste Excel no corresponde al vehículo seleccionado.\n\nVerifica que el Excel contenga registros de la placa ${expectedPlaca}.` 
    };
  }
  
  // Si hay múltiples placas, advertir pero permitir si la esperada está presente
  if (placasEnExcel.length > 1) {
    console.warn(`⚠️ Excel contiene múltiples placas: ${placasEnExcel.join(', ')}. Usando solo registros de ${expectedPlaca}`);
  }
  
  // Filtrar registros solo de la placa correcta para el análisis
  const recordsCorrectos = records.filter(r => r.movil.toUpperCase().trim() === expectedPlaca);
  
  if (recordsCorrectos.length === 0) {
    return { 
      valid: false, 
      message: `❌ No se encontraron registros de la placa ${expectedPlaca} en el Excel` 
    };
  }
  
  console.log(`✅ Encontrados ${recordsCorrectos.length} registros de la placa ${expectedPlaca}`);
  
  // Verificar que la fecha coincida (columna "Fecha GPS")
  // Formato del proveedor puede ser "2025/07/01 06:47:57" o Date object
  const hasMatchingDate = recordsCorrectos.some(record => {
    try {
      let recordDate: string;
      
      // Manejar diferentes formatos de fecha
      if (typeof record.fecha_gps === 'string') {
        const datePart = record.fecha_gps.split(' ')[0]; // "2025/07/01" o "2025-07-01"
        recordDate = datePart.replace(/\//g, '-'); // Normalizar a "2025-07-01"
      } else if (record.fecha_gps instanceof Date) {
        // Validar que el Date sea válido
        if (isNaN(record.fecha_gps.getTime())) {
          console.warn('⚠️ Fecha GPS inválida (Date):', record.fecha_gps);
          return false;
        }
        recordDate = record.fecha_gps.toISOString().split('T')[0]; // "2025-07-01"
      } else {
        // Intentar convertir si es número (timestamp de Excel)
        const dateObj = new Date(record.fecha_gps);
        if (!isNaN(dateObj.getTime())) {
          recordDate = dateObj.toISOString().split('T')[0];
        } else {
          console.warn('⚠️ Fecha GPS en formato desconocido:', typeof record.fecha_gps, record.fecha_gps);
          return false;
        }
      }
      
      // Comparar fechas normalizadas
    return recordDate === expectedDate;
    } catch (error) {
      console.warn('⚠️ Error comparando fecha:', error, record.fecha_gps);
      return false;
    }
  });
  
  if (!hasMatchingDate) {
    // Obtener fechas únicas del Excel para mostrar en el error
    const fechasEnExcel = [...new Set(recordsCorrectos.map(r => {
      try {
        let dateStr: string;
        
        if (typeof r.fecha_gps === 'string') {
          // Si es string, extraer la parte de fecha
          const datePart = r.fecha_gps.split(' ')[0]; // "2025/07/01" o "2025-07-01"
          dateStr = datePart.replace(/\//g, '-'); // Normalizar a "2025-07-01"
        } else if (r.fecha_gps instanceof Date) {
          // Si es Date object, convertir a ISO y extraer fecha
          if (isNaN(r.fecha_gps.getTime())) {
            return 'Fecha inválida';
          }
          dateStr = r.fecha_gps.toISOString().split('T')[0]; // "2025-07-01"
        } else {
          // Intentar convertir a Date si es un número (timestamp de Excel)
          const dateObj = new Date(r.fecha_gps);
          if (!isNaN(dateObj.getTime())) {
            dateStr = dateObj.toISOString().split('T')[0];
          } else {
            return String(r.fecha_gps).substring(0, 10); // Primeros 10 caracteres
          }
        }
        
        // Validar formato YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateStr;
        }
        
        return dateStr.substring(0, 10); // Fallback: primeros 10 caracteres
      } catch (error) {
        console.warn('⚠️ Error extrayendo fecha para mensaje:', error, r.fecha_gps);
        return String(r.fecha_gps).substring(0, 10) || 'N/A';
      }
    }).filter(f => f && f !== 'N/A' && f !== 'Fecha inválida'))];
    
    // Si no se encontraron fechas válidas, mostrar un mensaje más descriptivo
    const fechasDisplay = fechasEnExcel.length > 0 
      ? fechasEnExcel.join(', ')
      : 'No se pudieron extraer fechas del Excel';
    
    return { 
      valid: false, 
      message: `❌ Fecha incorrecta\n\nRegistro esperado: ${expectedDate}\nFechas en Excel: ${fechasDisplay}\n\nEste Excel no corresponde a la fecha seleccionada.\n\nVerifica que el Excel contenga registros del ${expectedDate}.` 
    };
  }
  
  console.log(`✅ Validación exitosa: Placa ${expectedPlaca} y fecha ${expectedDate} coinciden`);
  return { 
    valid: true, 
    message: `✅ Archivo correcto\nPlaca: ${expectedPlaca}\nFecha: ${expectedDate}\nRegistros de ${expectedPlaca}: ${recordsCorrectos.length} de ${records.length} totales` 
  };
};

/**
 * Subir registros GPS a Supabase
 * Optimizado para archivos grandes con mejor manejo de errores
 */
export const uploadGPSData = async (
  overtimeTrackingId: string,
  records: GPSRecord[]
): Promise<void> => {
  console.log(`📤 Subiendo ${records.length} registros GPS...`);
  
  // Primero, eliminar registros existentes para este overtime_tracking_id
  console.log('🗑️ Eliminando registros GPS existentes...');
  const { error: deleteError } = await supabase
    .from('gps_tracking')
    .delete()
    .eq('overtime_tracking_id', overtimeTrackingId);
  
  if (deleteError) {
    console.warn('⚠️ Error eliminando registros existentes (puede continuar):', deleteError);
  }
  
  // Preparar datos para insertar
  const dataToInsert = records.map(record => ({
    overtime_tracking_id: overtimeTrackingId,
    movil: record.movil,
    alias: record.alias,
    fecha_gps: parseGPSDate(record.fecha_gps),
    fecha_servidor: record.fecha_servidor ? parseGPSDate(record.fecha_servidor) : null,
    localizacion: record.localizacion,
    mensaje: record.mensaje,
    lat: record.lat,
    lng: record.lng,
    es_encendido: isMovilEncendido(record.mensaje),
    es_apagado: isMovilApagado(record.mensaje),
  }));
  
  // Insertar en lotes más pequeños para archivos grandes (50 registros por lote)
  const batchSize = 50;
  const totalBatches = Math.ceil(dataToInsert.length / batchSize);
  
  for (let i = 0; i < dataToInsert.length; i += batchSize) {
    const batch = dataToInsert.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    try {
    const { error } = await supabase.from('gps_tracking').insert(batch);
    
    if (error) {
        console.error(`❌ Error insertando batch ${batchNumber}/${totalBatches}:`, error);
        throw new Error(`Error insertando batch ${batchNumber}: ${error.message}`);
      }
      
      if (batchNumber % 10 === 0 || batchNumber === totalBatches) {
        console.log(`✅ Batch ${batchNumber}/${totalBatches} insertado (${Math.round((batchNumber / totalBatches) * 100)}%)`);
      }
    } catch (error: any) {
      console.error(`❌ Error crítico en batch ${batchNumber}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Todos los ${records.length} registros GPS subidos`);
};

/**
 * Analizar ruta directamente desde los registros en memoria (más eficiente)
 * Esto evita tener que consultar la base de datos después de subir
 */
export const analyzeRouteFromRecords = (records: GPSRecord[]): GPSAnalysisResult => {
  console.log(`🔍 Analizando ${records.length} registros GPS en memoria...`);
  
  // Detectar inicio y fin
  const routeStart = detectRouteStart(records);
  const routeEnd = detectRouteEnd(records);
  
  console.log('✅ Análisis completado en memoria');
  
  return {
    entrada: routeStart ? parseGPSDate(routeStart.fecha_gps) : null,
    salida: routeEnd ? parseGPSDate(routeEnd.fecha_gps) : null,
    ubicacion_entrada: routeStart?.localizacion || null,
    ubicacion_salida: routeEnd?.localizacion || null,
    lat_entrada: routeStart?.lat || null,
    lng_entrada: routeStart?.lng || null,
    lat_salida: routeEnd?.lat || null,
    lng_salida: routeEnd?.lng || null,
    total_records: records.length,
  };
};

/**
 * Analizar ruta y actualizar overtime_tracking con GPS entrada/salida
 * Versión optimizada que analiza en memoria antes de subir
 */
export const analyzeAndUpdateRoute = async (
  overtimeTrackingId: string,
  records?: GPSRecord[] // Si se proporciona, analiza en memoria
): Promise<GPSAnalysisResult> => {
  console.log('🔍 Analizando ruta GPS...');
  
  let analysis: GPSAnalysisResult;
  
  // Si se proporcionan los registros, analizar en memoria (más eficiente)
  if (records && records.length > 0) {
    analysis = analyzeRouteFromRecords(records);
  } else {
    // Si no, obtener de la base de datos (fallback)
    console.log('⚠️ No se proporcionaron registros, consultando base de datos...');
  const { data: gpsRecords, error } = await supabase
    .from('gps_tracking')
    .select('*')
    .eq('overtime_tracking_id', overtimeTrackingId)
    .order('fecha_gps', { ascending: true });
  
  if (error) {
    console.error('❌ Error obteniendo registros GPS:', error);
    throw error;
  }
  
  if (!gpsRecords || gpsRecords.length === 0) {
    throw new Error('No hay registros GPS para analizar');
  }
  
  // Convertir a formato GPSRecord
    const recordsFromDB: GPSRecord[] = gpsRecords.map(r => ({
    movil: r.movil,
    alias: r.alias,
    fecha_gps: r.fecha_gps,
    fecha_servidor: r.fecha_servidor,
    localizacion: r.localizacion,
    mensaje: r.mensaje,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
  }));
  
    analysis = analyzeRouteFromRecords(recordsFromDB);
  }
  
  // Extraer solo la hora (HH:MM:SS) de los timestamps GPS
  // IMPORTANTE: El trigger calculate_overtime() usará estos valores para calcular
  // H.E. Diurna, Des/Alm, Compensado, Total H.E. Diurna, H.E. Nocturna, Dom/Fest, Horas Finales
  let horaEntradaGPS: string | null = null;
  let horaSalidaGPS: string | null = null;
  
  if (analysis.entrada) {
    const date = new Date(analysis.entrada);
    // Formato TIME de PostgreSQL: HH:MM:SS
    horaEntradaGPS = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    console.log(`📅 GPS Entrada detectada: ${horaEntradaGPS} (desde ${analysis.entrada})`);
  }
  
  if (analysis.salida) {
    const date = new Date(analysis.salida);
    // Formato TIME de PostgreSQL: HH:MM:SS
    horaSalidaGPS = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    console.log(`📅 GPS Salida detectada: ${horaSalidaGPS} (desde ${analysis.salida})`);
  }
  
  // Actualizar overtime_tracking con valores GPS
  // El trigger calculate_overtime() se ejecutará automáticamente (BEFORE UPDATE)
  // y recalculará todas las columnas usando hora_entrada_gps y hora_salida_gps
  // en lugar de hora_entrada y hora_salida cuando los valores GPS estén disponibles
  console.log('💾 Actualizando overtime_tracking con valores GPS...');
  console.log('   El trigger calculará automáticamente: H.E. Diurna, Des/Alm, Compensado, Total H.E. Diurna, H.E. Nocturna, Dom/Fest, Horas Finales');
  
  const { error: updateError } = await supabase
    .from('overtime_tracking')
    .update({
      hora_entrada_gps: horaEntradaGPS,
      hora_salida_gps: horaSalidaGPS,
      ubicacion_inicio: analysis.ubicacion_entrada || null,
      ubicacion_fin: analysis.ubicacion_salida || null,
      gps_entrada: analysis.entrada,
      gps_salida: analysis.salida,
      gps_ubicacion_entrada: analysis.ubicacion_entrada || null,
      gps_ubicacion_salida: analysis.ubicacion_salida || null,
      gps_lat_entrada: analysis.lat_entrada,
      gps_lng_entrada: analysis.lng_entrada,
      gps_lat_salida: analysis.lat_salida,
      gps_lng_salida: analysis.lng_salida,
      gps_data_uploaded: true,
    })
    .eq('id', overtimeTrackingId);
  
  if (updateError) {
    console.error('❌ Error actualizando overtime_tracking:', updateError);
    throw updateError;
  }
  
  console.log('✅ Ruta analizada y actualizada');
  console.log('   ✅ Trigger calculate_overtime() ejecutado automáticamente');
  console.log('   ✅ Todas las columnas calculadas usando GPS Entrada y GPS Salida');
  
  return analysis;
};

/**
 * Obtener ruta completa para visualizar en mapa
 */
export const getRouteData = async (overtimeTrackingId: string) => {
  // Importar el interceptor dinámicamente para evitar dependencias circulares
  const { executeSupabaseQuery } = await import('./supabaseInterceptor');
  
  // Obtener todos los puntos GPS usando el interceptor (maneja automáticamente token refresh)
  const gpsResult = await executeSupabaseQuery(() =>
    supabase
    .from('gps_tracking')
    .select('*')
    .eq('overtime_tracking_id', overtimeTrackingId)
      .order('fecha_gps', { ascending: true })
  );
  
  if (gpsResult.error) {
    throw new Error(gpsResult.error.message || 'Error al obtener datos GPS');
  }
  
  const gpsData = (gpsResult.data || []) as GPSRecord[];
  
  // Obtener información del inicio y fin detectados por el algoritmo usando el interceptor
  let overtimeData = null;
  try {
    const overtimeResult = await executeSupabaseQuery(() =>
      supabase
        .from('overtime_tracking')
        .select('hora_entrada_gps, hora_salida_gps, ubicacion_inicio, ubicacion_fin, gps_entrada, gps_salida, gps_ubicacion_entrada, gps_ubicacion_salida')
        .eq('id', overtimeTrackingId)
        .single()
    );
    
    if (!overtimeResult.error && overtimeResult.data) {
      overtimeData = overtimeResult.data;
    }
  } catch (error) {
    console.warn('⚠️ No se pudo obtener información de inicio/fin del algoritmo:', error);
  }
  
  // Buscar los puntos GPS exactos que corresponden al inicio y fin detectados
  let routeStartPoint: GPSRecord | null = null;
  let routeEndPoint: GPSRecord | null = null;

  if (overtimeData && gpsData) {
    const entradaGPS = overtimeData.gps_entrada || overtimeData.hora_entrada_gps;
    const salidaGPS = overtimeData.gps_salida || overtimeData.hora_salida_gps;

    if (entradaGPS) {
      // Buscar el punto GPS más cercano al tiempo de entrada detectado
      const entradaTime = new Date(entradaGPS).getTime();
      routeStartPoint = gpsData.reduce((closest, point) => {
        const pointTime = new Date(point.fecha_gps).getTime();
        if (!closest) return point;
        const closestTime = new Date(closest.fecha_gps).getTime();
        return Math.abs(pointTime - entradaTime) < Math.abs(closestTime - entradaTime) ? point : closest;
      }, null as GPSRecord | null);
    }

    if (salidaGPS) {
      // Buscar el punto GPS más cercano al tiempo de salida detectado
      const salidaTime = new Date(salidaGPS).getTime();
      routeEndPoint = gpsData.reduce((closest, point) => {
        const pointTime = new Date(point.fecha_gps).getTime();
        if (!closest) return point;
        const closestTime = new Date(closest.fecha_gps).getTime();
        return Math.abs(pointTime - salidaTime) < Math.abs(closestTime - salidaTime) ? point : closest;
      }, null as GPSRecord | null);
    }
  }

  // Convertir GPSRecord[] a GPSPoint[] para el componente
  const points: Array<{
    lat: string | number;
    lng: string | number;
    fecha_gps: string;
    localizacion?: string;
    movil?: string;
  }> = gpsData.map(record => ({
    lat: record.lat,
    lng: record.lng,
    fecha_gps: record.fecha_gps,
    localizacion: record.localizacion,
    movil: record.movil,
  }));

  // Retornar datos con información adicional del inicio y fin
  return {
    points,
    routeStart: overtimeData && routeStartPoint ? {
      fecha_gps: overtimeData.gps_entrada || overtimeData.hora_entrada_gps || routeStartPoint.fecha_gps,
      localizacion: overtimeData.gps_ubicacion_entrada || overtimeData.ubicacion_inicio || routeStartPoint.localizacion || null,
      lat: routeStartPoint.lat,
      lng: routeStartPoint.lng,
    } : null,
    routeEnd: overtimeData && routeEndPoint ? {
      fecha_gps: overtimeData.gps_salida || overtimeData.hora_salida_gps || routeEndPoint.fecha_gps,
      localizacion: overtimeData.gps_ubicacion_salida || overtimeData.ubicacion_fin || routeEndPoint.localizacion || null,
      lat: routeEndPoint.lat,
      lng: routeEndPoint.lng,
    } : null,
  };
};

