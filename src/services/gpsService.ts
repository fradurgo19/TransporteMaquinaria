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
  
  try {
    const record: GPSRecord = {
      movil: (getColumn(['Movil', 'Móvil', 'Placa', 'Vehiculo', 'Vehículo']) || '').toString().trim(),
      alias: (getColumn(['Alias', 'Nombre', 'Empresa', 'Cliente']) || '').toString().trim(),
      fecha_gps: (getColumn(['Fecha GPS', 'FechaGPS', 'Fecha', 'Date GPS', 'GPS Date']) || '').toString().trim(),
      fecha_servidor: (getColumn(['Fecha Servidor', 'FechaServidor', 'Server Date', 'Fecha Server']) || '').toString().trim(),
      localizacion: (getColumn(['Localizacion', 'Localización', 'Ubicacion', 'Ubicación', 'Location', 'Lugar']) || '').toString().trim(),
      mensaje: (getColumn(['Mensaje', 'Message', 'Estado', 'Status', 'Evento', 'Event']) || '').toString().trim(),
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
 * Algoritmo inteligente para detectar inicio real del recorrido
 * Condiciones:
 * 1. Buscar "Movil Encendido"
 * 2. Verificar que se mueva de ubicación (cambio en Lat/Lng)
 * 3. Si no se mueve en 20 min, buscar el siguiente encendido
 */
export const detectRouteStart = (records: GPSRecord[]): GPSRecord | null => {
  console.log('🔍 Detectando inicio del recorrido...');
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Buscar "Movil Encendido"
    if (record.mensaje.includes('Movil  Encendido')) {
      console.log(`✅ Encendido encontrado en ${record.fecha_gps}`);
      
      // Verificar si se mueve en los próximos registros
      let moved = false;
      const startLat = record.lat;
      const startLng = record.lng;
      
      // Revisar siguientes 10 registros (aprox 30 min)
      for (let j = i + 1; j < Math.min(i + 10, records.length); j++) {
        const nextRecord = records[j];
        
        // Cambio significativo de ubicación (>100 metros aprox)
        const latDiff = Math.abs(nextRecord.lat - startLat);
        const lngDiff = Math.abs(nextRecord.lng - startLng);
        
        if (latDiff > 0.001 || lngDiff > 0.001) {
          moved = true;
          console.log(`🚗 Movimiento detectado en ${nextRecord.fecha_gps}`);
          break;
        }
      }
      
      if (moved) {
        console.log(`✅ Inicio real del recorrido: ${record.fecha_gps} en ${record.localizacion}`);
        return record;
      } else {
        console.log(`⚠️ No se movió después de encender, buscando siguiente...`);
      }
    }
  }
  
  console.log('❌ No se detectó inicio de recorrido');
  return null;
};

/**
 * Algoritmo inteligente para detectar fin real del recorrido
 * Condiciones:
 * 1. Buscar "Movil Apagado"
 * 2. Verificar que se mantenga en el mismo lugar por >20 min
 */
export const detectRouteEnd = (records: GPSRecord[]): GPSRecord | null => {
  console.log('🔍 Detectando fin del recorrido...');
  
  // Buscar desde el final hacia atrás
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    
    // Buscar "Movil Apagado"
    if (record.mensaje.includes('Movil  Apagado')) {
      console.log(`🛑 Apagado encontrado en ${record.fecha_gps}`);
      
      // Verificar que se mantenga apagado en el mismo lugar
      let stayedOff = true;
      const endLat = record.lat;
      const endLng = record.lng;
      let offCount = 0;
      
      // Revisar siguientes registros (después de apagar)
      for (let j = i + 1; j < Math.min(i + 5, records.length); j++) {
        const nextRecord = records[j];
        
        // Verificar que siga apagado
        if (nextRecord.mensaje.includes('Movil Apagado')) {
          offCount++;
          
          // Verificar que no se haya movido
          const latDiff = Math.abs(nextRecord.lat - endLat);
          const lngDiff = Math.abs(nextRecord.lng - endLng);
          
          if (latDiff > 0.001 || lngDiff > 0.001) {
            stayedOff = false;
            break;
          }
        } else if (nextRecord.mensaje.includes('Movil  Encendido')) {
          stayedOff = false;
          break;
        }
      }
      
      // Mínimo 2 reportes apagado en el mismo lugar (20 min)
      if (stayedOff && offCount >= 2) {
        console.log(`✅ Fin real del recorrido: ${record.fecha_gps} en ${record.localizacion}`);
        return record;
      }
    }
  }
  
  console.log('❌ No se detectó fin de recorrido');
  return null;
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
  
  // Verificar que la placa coincida (columna "Movil")
  const firstRecord = records[0];
  const excelPlaca = firstRecord.movil.toUpperCase().trim();
  
  if (excelPlaca !== expectedPlaca) {
    return { 
      valid: false, 
      message: `❌ Placa incorrecta\n\nRegistro: ${expectedPlaca}\nExcel: ${excelPlaca}\n\nEste Excel no corresponde al vehículo seleccionado.` 
    };
  }
  
  // Verificar que la fecha coincida (columna "Fecha GPS")
  // Formato del proveedor: "2025/07/01 06:47:57"
  const firstGPSDate = firstRecord.fecha_gps.split(' ')[0]; // "2025/07/01"
  const excelDate = firstGPSDate.replace(/\//g, '-'); // "2025-07-01"
  
  // Buscar al menos un registro con la fecha correcta
  const hasMatchingDate = records.some(record => {
    const recordDate = record.fecha_gps.split(' ')[0].replace(/\//g, '-');
    return recordDate === expectedDate;
  });
  
  if (!hasMatchingDate) {
    return { 
      valid: false, 
      message: `❌ Fecha incorrecta\n\nRegistro: ${expectedDate}\nExcel: ${excelDate}\n\nEste Excel no corresponde a la fecha seleccionada.` 
    };
  }
  
  console.log(`✅ Validación exitosa: Placa y fecha coinciden`);
  return { 
    valid: true, 
    message: `✅ Archivo correcto\nPlaca: ${expectedPlaca}\nFecha: ${expectedDate}\nRegistros: ${records.length}` 
  };
};

/**
 * Subir registros GPS a Supabase
 */
export const uploadGPSData = async (
  overtimeTrackingId: string,
  records: GPSRecord[]
): Promise<void> => {
  console.log(`📤 Subiendo ${records.length} registros GPS...`);
  
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
    es_encendido: record.mensaje.includes('Movil  Encendido'),
    es_apagado: record.mensaje.includes('Movil  Apagado'),
  }));
  
  // Insertar en lotes de 100
  const batchSize = 100;
  for (let i = 0; i < dataToInsert.length; i += batchSize) {
    const batch = dataToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('gps_tracking').insert(batch);
    
    if (error) {
      console.error('❌ Error insertando batch:', error);
      throw error;
    }
    
    console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} insertado`);
  }
  
  console.log('✅ Todos los registros GPS subidos');
};

/**
 * Analizar ruta y actualizar overtime_tracking con GPS entrada/salida
 */
export const analyzeAndUpdateRoute = async (
  overtimeTrackingId: string
): Promise<GPSAnalysisResult> => {
  console.log('🔍 Analizando ruta GPS...');
  
  // Obtener todos los registros GPS
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
  
  console.log(`📊 Analizando ${gpsRecords.length} registros GPS`);
  
  // Convertir a formato GPSRecord
  const records: GPSRecord[] = gpsRecords.map(r => ({
    movil: r.movil,
    alias: r.alias,
    fecha_gps: r.fecha_gps,
    fecha_servidor: r.fecha_servidor,
    localizacion: r.localizacion,
    mensaje: r.mensaje,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
  }));
  
  // Detectar inicio y fin
  const routeStart = detectRouteStart(records);
  const routeEnd = detectRouteEnd(records);
  
  // Actualizar overtime_tracking
  const { error: updateError } = await supabase
    .from('overtime_tracking')
    .update({
      gps_entrada: routeStart ? parseGPSDate(routeStart.fecha_gps) : null,
      gps_salida: routeEnd ? parseGPSDate(routeEnd.fecha_gps) : null,
      gps_ubicacion_entrada: routeStart?.localizacion || null,
      gps_ubicacion_salida: routeEnd?.localizacion || null,
      gps_lat_entrada: routeStart?.lat || null,
      gps_lng_entrada: routeStart?.lng || null,
      gps_lat_salida: routeEnd?.lat || null,
      gps_lng_salida: routeEnd?.lng || null,
      gps_data_uploaded: true,
    })
    .eq('id', overtimeTrackingId);
  
  if (updateError) {
    console.error('❌ Error actualizando overtime_tracking:', updateError);
    throw updateError;
  }
  
  console.log('✅ Ruta analizada y actualizada');
  
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
 * Obtener ruta completa para visualizar en mapa
 */
export const getRouteData = async (overtimeTrackingId: string) => {
  const { data, error } = await supabase
    .from('gps_tracking')
    .select('*')
    .eq('overtime_tracking_id', overtimeTrackingId)
    .order('fecha_gps', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

