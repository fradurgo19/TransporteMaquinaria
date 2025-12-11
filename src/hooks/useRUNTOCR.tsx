import { useState } from 'react';
import Tesseract from 'tesseract.js';

interface RUNTOCRResult {
  text: string;
  serie: string;
  descripcion: string;
  marca: string;
  linea: string;
  modelo: string;
  ancho: string;
  alto: string;
  largo: string;
  peso: string;
  // Nuevos campos adicionales
  numero_identificacion: string;
  numero_serie_gps: string;
  numero_imei_gps: string;
  clase: string;
  cilindraje: string;
  numero_motor: string;
  numero_chasis: string;
  subpartida_arancelaria: string;
  rodaje: string;
  estado_vehiculo: string;
  empresa_gps: string;
}

export const useRUNTOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const extractDataFromRUNT = async (imageFile: File): Promise<RUNTOCRResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'spa+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
        }
      );

      console.log('📝 Texto extraído del RUNT:', text);

      // Función auxiliar para extraer valor después de una etiqueta
      const extractValueAfterLabel = (text: string, label: string, pattern?: RegExp): string => {
        // Buscar la etiqueta en el texto (puede tener espacios, dos puntos, etc.)
        // Buscar con diferentes variaciones de la etiqueta
        const labelVariations = [
          label + '[:\\s]+',
          label + '[\\s]*[:][\\s]*',
          label.replace(/\./g, '\\.') + '[:\\s]+',
        ];
        
        let labelMatch: RegExpMatchArray | null = null;
        for (const variation of labelVariations) {
          const labelRegex = new RegExp(variation, 'i');
          labelMatch = text.match(labelRegex);
          if (labelMatch) break;
        }
        
        if (!labelMatch) return '';

        // Encontrar la posición después de la etiqueta
        const labelIndex = labelMatch.index! + labelMatch[0].length;
        
        // Extraer el texto después de la etiqueta (hasta 300 caracteres)
        const afterLabel = text.substring(labelIndex, labelIndex + 300);
        
        // Si hay un patrón específico, usarlo primero
        if (pattern) {
          const match = afterLabel.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        
        // Si no hay patrón o no funcionó, buscar el siguiente valor no vacío
        // Para números, buscar patrones numéricos primero
        const numberPattern = /(\d+[.,]?\d*)/;
        const numberMatch = afterLabel.match(numberPattern);
        if (numberMatch && numberMatch[1]) {
          return numberMatch[1].trim();
        }
        
        // Para texto, dividir por líneas y espacios
        const tokens = afterLabel.split(/[\n\s]+/);
        for (const token of tokens) {
          const cleanToken = token.trim();
          // Ignorar tokens vacíos, solo con signos de puntuación, o muy cortos
          if (cleanToken.length >= 2 && /[\w\d]/.test(cleanToken)) {
            return cleanToken;
          }
        }
        return '';
      };

      // Función para convertir milímetros a metros
      const mmToMeters = (value: string): string => {
        const num = parseFloat(value.replace(',', '.'));
        if (isNaN(num)) return '';
        // Si el número es mayor a 10, probablemente está en mm, convertir a metros
        if (num > 10) {
          return (num / 1000).toFixed(2);
        }
        // Si es menor o igual a 10, ya está en metros
        return num.toFixed(2);
      };

      // Patrones mejorados para extraer serie/Nro. serie
      // Nota: OCR puede confundir caracteres (I/1, O/0, S/5, etc.)
      const seriePatterns = [
        /Nro\.\s*serie[:\s]*([A-Z0-9-]{5,})/i, // Priorizar "Nro. serie" con mínimo 5 caracteres
        /Número\s*único\s*de\s*identificación[:\s]*([A-Z0-9-]{5,})/i,
        /Nro\.\s*de\s*identificación[:\s]*([A-Z0-9-]{5,})/i,
        /Nro\.\s*serie[:\s]*([A-Z0-9]{8,})/i, // Formato largo como HCMDEPA1V00072991
        /(HCMDEPA[0-9A-Z]{8,})/i, // Formato específico Hitachi
        /(MC[0-9I]{6,})/i, // Formato MC seguido de números (puede confundir I con 1)
        /(THEDA[0O][0-9A-Z]{8,})/i, // Formato THEDA seguido de números/letras (puede confundir O con 0)
        /serie[:\s]*([A-Z0-9-]{5,})/i,
      ];

      // Patrones mejorados para descripción/Clase
      const descripcionPatterns = [
        /Clase[:\s]+([A-ZÁÉÍÓÚÑ\s]{3,20})(?:\n|Marca|Linea|Modelo|Tipo|$)/i,
        /Clase\s*del\s*vehículo[:\s]+([A-ZÁÉÍÓÚÑ\s]{3,20})(?:\n|Marca|Linea|Modelo|Tipo|$)/i,
        /Clase[:\s]+(EXCAVADORA|CARGADORA|RETROEXCAVADORA|MOTONIVELADORA|COMPACTADORA|CAMIÓN|VOLQUETA)/i,
      ];

      // Patrones mejorados para marca - buscar específicamente después de "Marca:"
      const marcaPatterns = [
        /Marca[:\s]+([A-ZÁÉÍÓÚÑ\s]{2,30})(?:\n|Linea|Modelo|Tipo|Color|ZX|$)/i,
        /Marca\s*del\s*vehículo[:\s]+([A-ZÁÉÍÓÚÑ\s]{2,30})(?:\n|Linea|Modelo|Tipo|Color|ZX|$)/i,
        /Marca[:\s]+(HITACHI|CATERPILLAR|KOMATSU|VOLVO|JOHN\s*DEERE|CASE|BOBCAT|KUBOTA)/i,
      ];

      // Patrones para línea (ej: ZX75USK-5B, ZX140H)
      // Nota: OCR puede confundir Z con 2, X con X, etc.
      const lineaPatterns = [
        /Linea[:\s]+([A-Z0-9-]{3,30})(?:\n|Tipo|Modelo|Color|$)/i,
        /Línea[:\s]+([A-Z0-9-]{3,30})(?:\n|Tipo|Modelo|Color|$)/i,
        /Linea[:\s]+([Z2]X\d+[A-Z0-9-]+)/i, // Formato específico ZX o 2X (OCR puede confundir Z con 2)
        /([Z2]X\d+[A-Z0-9-]+)/i, // Buscar cualquier patrón ZX/2X seguido de números y letras
        /Linea[:\s]+(ZX\d+[A-Z0-9-]+)/i, // Formato específico ZX75USK-5B
        /(ZX\d+[A-Z0-9-]+)/i, // Buscar cualquier patrón ZX seguido de números y letras
      ];

      // Patrones mejorados para modelo (año) - debe ser un año, no la línea
      const modeloPatterns = [
        /Modelo[:\s]+(\d{4})(?:\s|$|\n)/i, // Buscar año de 4 dígitos después de "Modelo:"
        /Año\s*modelo[:\s]+(\d{4})(?:\s|$|\n)/i,
        /Modelo[:\s]+(\d{2,4})(?:\s|$|\n)/i,
      ];

      // Patrones mejorados para ancho (buscar números con decimales, pueden estar en mm)
      const anchoPatterns = [
        /Ancho[:\s]+(\d+[.,]\d+)/i,
        /Ancho[:\s]+(\d{3,})/i, // Si está en mm (ej: 2320)
      ];

      // Patrones mejorados para alto
      const altoPatterns = [
        /Alto[:\s]+(\d+[.,]\d+)/i,
        /Alto[:\s]+(\d{3,})/i, // Si está en mm (ej: 2690)
      ];

      // Patrones mejorados para largo
      const largoPatterns = [
        /Largo[:\s]+(\d+[.,]\d+)/i,
        /Largo[:\s]+(\d{3,})/i, // Si está en mm (ej: 6370)
      ];

      // Patrones mejorados para peso (buscar "Peso bruto vehicular")
      const pesoPatterns = [
        /Peso\s*bruto\s*vehicular[:\s]+(\d+[.,]\d+)/i,
        /Peso\s*bruto\s*vehicular[:\s]+(\d{3,})/i,
        /Peso\s*bruto[:\s]+(\d+[.,]\d+)/i,
        /Peso[:\s]+(\d+[.,]\d+)/i,
      ];

      // Extraer serie - buscar específicamente "Nro. serie" y su valor
      // Nota: OCR puede confundir O con 0, I con 1, L con 1
      let serie = '';
      // Primero intentar con el método de extracción después de etiqueta
      // Buscar "Nro. serie" o variaciones
      const serieLabels = ['Nro. serie', 'Nro serie', 'Número serie', 'Nro. de serie'];
      for (const label of serieLabels) {
        serie = extractValueAfterLabel(text, label, /([A-Z0-9O-]{8,})/i);
        if (!serie || serie.length < 8) {
          // Intentar sin patrón específico
          serie = extractValueAfterLabel(text, label);
          if (serie) {
            serie = serie.toUpperCase().replace(/[^A-Z0-9O-]/g, '');
            // Corregir errores comunes de OCR: O en medio de números -> 0
            // Pero mantener O si es parte de una palabra (ej: THEDAOLOL)
            serie = serie.replace(/(\d)O(\d)/g, '$10$2'); // O entre números -> 0
            if (serie.length >= 8) break;
          }
        } else {
          // Corregir errores comunes de OCR: O en medio de números -> 0
          serie = serie.replace(/(\d)O(\d)/g, '$10$2');
          break;
        }
      }
      
      // Si aún no hay serie, usar patrones regex
      if (!serie || serie.length < 5) {
        for (const pattern of seriePatterns) {
          const matches = [...text.matchAll(new RegExp(pattern.source, 'gi'))];
          for (const match of matches) {
            if (match[1]) {
              let candidate = match[1].trim().toUpperCase().replace(/[^A-Z0-9O-]/g, '');
              // Corregir errores comunes de OCR: O en medio de números -> 0
              candidate = candidate.replace(/(\d)O(\d)/g, '$10$2');
              // Priorizar series largas (más de 8 caracteres)
              if (candidate.length >= 8) {
                serie = candidate;
                break;
              }
              if (candidate.length >= 5 && !serie) {
                serie = candidate;
              }
            }
          }
          if (serie && serie.length >= 8) break;
        }
      }

      // Extraer descripción (Clase) - buscar después de "Clase:"
      // IMPORTANTE: Debe detenerse antes de títulos de otros campos como "IDENTIFICACIÓN"
      let descripcion = '';
      descripcion = extractValueAfterLabel(text, 'Clase', /([A-ZÁÉÍÓÚÑ\s]{3,30})/i);
      if (descripcion) {
        descripcion = descripcion.toUpperCase().replace(/\s+/g, ' ').trim();
        
        // Lista completa de stop words que son títulos de otros campos
        // Estas palabras indican el inicio de otro campo y debemos cortar ANTES de ellas
        const stopWords = [
          'IDENTIFICACIÓN', 'IDENTIFICACION', 'IDENTIF', 'IDENT',
          'NÚMERO ÚNICO', 'NUMERO UNICO', 'NÚMERO', 'NUMERO', 'NRO', 'NRO.',
          'SERIE', 'MARCA', 'MODELO', 'LÍNEA', 'LINEA', 'TIPO',
          'COLOR', 'CARROCERÍA', 'CARROCERIA', 'CABINA',
          'MAQUINARIA', 'EJES', 'LARGO', 'ALTO', 'ANCHO',
          'PESO', 'RODAJE', 'ESTADO', 'FECHA', 'MATRÍCULA', 'MATRICULA',
          'GPS', 'IMEI', 'EMPRESA', 'HABILITACIÓN', 'HABILITACION',
          'PROVEEDOR', 'NACIONAL', 'DISPOSITIVO', 'ORIGEN', 'REGISTRO',
          'CILINDRAJE', 'MOTOR', 'CHASIS', 'VIN', 'SUBPARTIDA'
        ];
        
        // Buscar la primera stop word y cortar antes de ella
        let minIndex = descripcion.length;
        for (const stopWord of stopWords) {
          // Buscar la palabra completa (con límites de palabra para evitar falsos positivos)
          const regex = new RegExp(`\\b${stopWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          const match = descripcion.match(regex);
          if (match && match.index !== undefined && match.index > 0) {
            if (match.index < minIndex) {
              minIndex = match.index;
            }
          }
          // También buscar sin límites de palabra (por si acaso)
          const simpleIndex = descripcion.indexOf(stopWord);
          if (simpleIndex > 0 && simpleIndex < minIndex) {
            minIndex = simpleIndex;
          }
        }
        
        // Si encontramos una stop word, cortar antes de ella
        if (minIndex < descripcion.length) {
          descripcion = descripcion.substring(0, minIndex).trim();
        }
        
        // Limpiar espacios múltiples y caracteres extra
        descripcion = descripcion.replace(/\s+/g, ' ').trim();
        
        // Validar que tenga al menos 3 caracteres después de limpiar
        if (descripcion.length < 3) {
          descripcion = '';
        }
      }
      if (!descripcion || descripcion.length < 3) {
        for (const pattern of descripcionPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            descripcion = match[1].trim().toUpperCase();
            // Detener en palabras clave antes de limpiar
            const stopWords = ['MARCA', 'LINEA', 'MODELO', 'TIPO', 'IDENTIFICACIÓN', 'IDENTIFICACION', 'NÚMERO', 'NUMERO', 'NRO', 'NRO.'];
            for (const stopWord of stopWords) {
              const stopIndex = descripcion.indexOf(stopWord);
              if (stopIndex > 0) {
                descripcion = descripcion.substring(0, stopIndex).trim();
                break;
              }
            }
            descripcion = descripcion.replace(/\s+/g, ' ').replace(/[^\w\sÁÉÍÓÚÑáéíóúñ]/g, '').trim();
            if (descripcion.length >= 3) {
              break;
            }
          }
        }
      }

      // Extraer marca - buscar después de "Marca:" y detener antes de "Linea" o "ZX"
      let marca = '';
      marca = extractValueAfterLabel(text, 'Marca', /([A-ZÁÉÍÓÚÑ\s]{2,30})/i);
      if (marca) {
        marca = marca.toUpperCase().trim();
        // Detener en palabras clave como "Linea", "Línea", "ZX" (que indica el inicio de la línea)
        const stopWords = ['LINEA', 'LÍNEA', 'MODELO', 'TIPO', 'COLOR', 'CILINDRAJE', 'ZX'];
        for (const stopWord of stopWords) {
          const stopIndex = marca.indexOf(stopWord);
          if (stopIndex > 0) {
            marca = marca.substring(0, stopIndex).trim();
            break;
          }
        }
        marca = marca.replace(/\s+/g, ' ').replace(/[^\w\sÁÉÍÓÚÑáéíóúñ]/g, '').trim();
        // Si solo quedó una palabra, tomarla
        const words = marca.split(/\s+/);
        if (words.length > 1) {
          // Tomar solo la primera palabra como marca (ej: "HITACHI" en lugar de "HITACHI PARTEQUIPOS")
          marca = words[0];
        }
      }
      if (!marca || marca.length < 2) {
        for (const pattern of marcaPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            let candidate = match[1].trim().toUpperCase();
            candidate = candidate.replace(/\s+/g, ' ').replace(/[^\w\sÁÉÍÓÚÑáéíóúñ]/g, '').trim();
            // Detener en palabras clave
            const stopWords = ['LINEA', 'LÍNEA', 'MODELO', 'TIPO', 'COLOR', 'CILINDRAJE', 'ZX'];
            for (const stopWord of stopWords) {
              const stopIndex = candidate.indexOf(stopWord);
              if (stopIndex > 0) {
                candidate = candidate.substring(0, stopIndex).trim();
                break;
              }
            }
            // Tomar solo la primera palabra si hay múltiples
            const words = candidate.split(/\s+/);
            if (words.length > 0) {
              marca = words[0];
              if (marca.length >= 2) {
                break;
              }
            }
          }
        }
      }

      // Extraer línea (ej: ZX75USK-5B) - buscar después de "Linea:" o "Línea:"
      let linea = '';
      linea = extractValueAfterLabel(text, 'Linea', /([A-Z0-9-]{3,30})/i);
      if (!linea || linea.length < 3) {
        linea = extractValueAfterLabel(text, 'Línea', /([A-Z0-9-]{3,30})/i);
      }
      if (linea) {
        linea = linea.toUpperCase().trim();
        // Detener en palabras clave
        const stopWords = ['TIPO', 'MODELO', 'COLOR', 'CILINDRAJE'];
        for (const stopWord of stopWords) {
          const stopIndex = linea.indexOf(stopWord);
          if (stopIndex > 0) {
            linea = linea.substring(0, stopIndex).trim();
            break;
          }
        }
        // Limpiar espacios y caracteres no deseados, pero mantener guiones
        linea = linea.replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
        // Corregir errores comunes de OCR: 2X -> ZX (OCR puede confundir Z con 2)
        if (linea.startsWith('2X')) {
          linea = 'ZX' + linea.substring(2);
        }
      }
      if (!linea || linea.length < 3) {
        for (const pattern of lineaPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            linea = match[1].trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
            // Corregir errores comunes de OCR: 2X -> ZX
            if (linea.startsWith('2X')) {
              linea = 'ZX' + linea.substring(2);
            }
            if (linea.length >= 3) {
              break;
            }
          }
        }
      }

      // Extraer modelo (año) - debe ser un año, NO la línea
      let modelo = '';
      modelo = extractValueAfterLabel(text, 'Modelo', /(\d{4})/i);
      if (modelo) {
        const year = parseInt(modelo.trim());
        // Validar que sea un año razonable (1900-2100)
        if (year < 1900 || year > 2100) {
          modelo = '';
        } else {
          modelo = year.toString();
        }
      }
      if (!modelo) {
        for (const pattern of modeloPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const year = parseInt(match[1].trim());
            // Validar que sea un año razonable (1900-2100)
            if (year >= 1900 && year <= 2100) {
              modelo = year.toString();
              break;
            }
          }
        }
      }

      // Extraer ancho (convertir mm a metros si es necesario) - buscar número con decimales
      let ancho = '';
      const anchoValue = extractValueAfterLabel(text, 'Ancho', /(\d+[.,]\d+|\d{3,})/i);
      if (anchoValue) {
        // Limpiar el valor extraído
        const cleanValue = anchoValue.replace(/[^\d.,]/g, '').replace(',', '.');
        ancho = mmToMeters(cleanValue);
      }
      if (!ancho) {
        for (const pattern of anchoPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = match[1].replace(',', '.').replace(/[^\d.]/g, '');
            ancho = mmToMeters(value);
            if (ancho) break;
          }
        }
      }

      // Extraer alto (convertir mm a metros si es necesario)
      // Nota: OCR puede leer "27180" como "27180" (ya está en mm, necesita conversión)
      let alto = '';
      const altoValue = extractValueAfterLabel(text, 'Alto', /(\d+[.,]\d+|\d{3,})/i);
      if (altoValue) {
        let cleanValue = altoValue.replace(/[^\d.,]/g, '').replace(',', '.');
        // Si el número es muy grande (>1000), probablemente está en mm
        const numValue = parseFloat(cleanValue);
        if (numValue > 1000) {
          // Está en mm, convertir a metros
          cleanValue = (numValue / 1000).toFixed(2);
        }
        alto = mmToMeters(cleanValue);
      }
      if (!alto) {
        for (const pattern of altoPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            let value = match[1].replace(',', '.').replace(/[^\d.]/g, '');
            const numValue = parseFloat(value);
            if (numValue > 1000) {
              value = (numValue / 1000).toFixed(2);
            }
            alto = mmToMeters(value);
            if (alto) break;
          }
        }
      }

      // Extraer largo (convertir mm a metros si es necesario)
      // Nota: OCR puede leer "7710" como "7710" (ya está en mm, necesita conversión)
      let largo = '';
      const largoValue = extractValueAfterLabel(text, 'Largo', /(\d+[.,]\d+|\d{3,})/i);
      if (largoValue) {
        let cleanValue = largoValue.replace(/[^\d.,]/g, '').replace(',', '.');
        // Si el número es muy grande (>1000), probablemente está en mm
        const numValue = parseFloat(cleanValue);
        if (numValue > 1000) {
          // Está en mm, convertir a metros
          cleanValue = (numValue / 1000).toFixed(2);
        }
        largo = mmToMeters(cleanValue);
      }
      if (!largo) {
        for (const pattern of largoPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            let value = match[1].replace(',', '.').replace(/[^\d.]/g, '');
            const numValue = parseFloat(value);
            if (numValue > 1000) {
              value = (numValue / 1000).toFixed(2);
            }
            largo = mmToMeters(value);
            if (largo) break;
          }
        }
      }

      // Extraer peso (en kg, buscar "Peso bruto vehicular") - debe incluir decimales
      let peso = '';
      const pesoLabels = ['Peso bruto vehicular', 'Peso bruto', 'Peso'];
      for (const label of pesoLabels) {
        const pesoValue = extractValueAfterLabel(text, label, /(\d+[.,]\d+|\d{3,})/i);
        if (pesoValue) {
          peso = pesoValue.replace(/[^\d.,]/g, '').replace(',', '.');
          const num = parseFloat(peso);
          if (!isNaN(num) && num > 0) {
            break;
          }
        }
      }
      if (!peso) {
        for (const pattern of pesoPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            peso = match[1].replace(/[^\d.,]/g, '').replace(',', '.');
            // Validar que sea un número razonable
            const num = parseFloat(peso);
            if (!isNaN(num) && num > 0) {
              break;
            }
          }
        }
      }

      // Extraer Número único de identificación (MC613143)
      let numero_identificacion = '';
      const numeroIdentificacionLabels = [
        'Número único de identificación',
        'Nro. único de identificación',
        'Número único identificación',
        'Nro único identificación',
        'Número de identificación único',
        'Número único',
        'Nro. único',
        'Identificación',
      ];
      
      // Primero intentar con las etiquetas completas
      for (const label of numeroIdentificacionLabels) {
        // Buscar formato específico: 2 letras seguidas de 6+ números (ej: MC613143)
        numero_identificacion = extractValueAfterLabel(text, label, /([A-Z]{2}\d{6,})/i);
        if (numero_identificacion && numero_identificacion.length >= 6) {
          numero_identificacion = numero_identificacion.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (numero_identificacion.length >= 6) {
            break;
          }
        }
      }
      
      // Si no se encontró, buscar después de "IDENTIFICACIÓN" o "IDENTIFICACION"
      if (!numero_identificacion || numero_identificacion.length < 6) {
        const identificacionLabels = ['IDENTIFICACIÓN', 'IDENTIFICACION', 'Identificación', 'Identificacion'];
        for (const label of identificacionLabels) {
          // Buscar el valor después de la etiqueta, puede estar en la misma línea o siguiente
          const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`${escapedLabel}[:\\s]+([A-Z]{2}\\d{6,})`, 'i');
          const match = text.match(regex);
          if (match && match[1]) {
            numero_identificacion = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (numero_identificacion.length >= 6) {
              break;
            }
          }
        }
      }
      
      // Patrón específico para formato MC seguido de números (MC613143)
      // Nota: OCR puede confundir I con 1, O con 0, S con 5
      if (!numero_identificacion || numero_identificacion.length < 6) {
        // Buscar MC seguido de exactamente 6 números (puede incluir I que es 1)
        const match = text.match(/(MC[0-9I]{6})/i);
        if (match && match[1]) {
          numero_identificacion = match[1].toUpperCase();
          // Corregir errores comunes de OCR: I -> 1
          numero_identificacion = numero_identificacion.replace(/I/g, '1');
        } else {
          // Buscar cualquier formato de 2 letras + 6+ números que aparezca después de "Clase" o "Descripción"
          // Esto captura casos donde el número está cerca de la descripción
          const match2 = text.match(/(?:Clase|Descripción)[:\s]+[A-Z\s]+[:\s]+([A-Z]{2}[0-9I]{6,})/i);
          if (match2 && match2[1]) {
            numero_identificacion = match2[1].toUpperCase().replace(/[^A-Z0-9I]/g, '');
            // Corregir errores comunes de OCR: I -> 1
            numero_identificacion = numero_identificacion.replace(/I/g, '1');
          } else {
            // Buscar cualquier formato de 2 letras + 6+ números en el texto
            const match3 = text.match(/([A-Z]{2}[0-9I]{6,})/i);
            if (match3 && match3[1]) {
              numero_identificacion = match3[1].toUpperCase().replace(/[^A-Z0-9I]/g, '');
              // Corregir errores comunes de OCR: I -> 1
              numero_identificacion = numero_identificacion.replace(/I/g, '1');
            }
          }
        }
      }

      // Extraer Nro. de identificación o serie del GPS (RAS90CK12404)
      let numero_serie_gps = '';
      const gpsSerieLabels = [
        'Nro. de identificación o serie del GPS de proveedor nacional',
        'Nro. de identificación o serie del GPS',
        'Nro identificación serie GPS',
        'Serie del GPS de proveedor nacional',
        'Serie del GPS',
        'Nro. serie GPS',
        'Nro. de identificación GPS',
        'Identificación GPS',
      ];
      for (const label of gpsSerieLabels) {
        // Buscar formato específico: 3 letras (RAS) + números + letras/números (ej: RAS90CK12404)
        numero_serie_gps = extractValueAfterLabel(text, label, /([A-Z]{3}\d+[A-Z0-9]{5,})/i);
        if (numero_serie_gps && numero_serie_gps.length >= 8) {
          numero_serie_gps = numero_serie_gps.toUpperCase().replace(/[^A-Z0-9]/g, '');
          break;
        }
      }
      // Patrón específico para formato RAS seguido de números y letras (RAS90CK12404)
      if (!numero_serie_gps || numero_serie_gps.length < 8) {
        // Buscar RAS seguido de números y letras (formato específico)
        const match = text.match(/(RAS\d+[A-Z0-9]{5,})/i);
        if (match && match[1]) {
          numero_serie_gps = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
        } else {
          // Buscar cualquier formato de 3 letras + números + letras/números
          const match2 = text.match(/([A-Z]{3}\d+[A-Z0-9]{5,})/i);
          if (match2 && match2[1]) {
            numero_serie_gps = match2[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
          }
        }
      }

      // Extraer Nro. de IMEI del GPS (865413050955086)
      let numero_imei_gps = '';
      const imeiLabels = [
        'Nro. de IMEI del GPS de proveedor nacional',
        'Nro. de IMEI del GPS',
        'Nro IMEI GPS',
        'IMEI del GPS de proveedor nacional',
        'IMEI del GPS',
        'Nro. IMEI',
        'IMEI',
      ];
      for (const label of imeiLabels) {
        // Buscar número de exactamente 15 dígitos (formato IMEI estándar)
        numero_imei_gps = extractValueAfterLabel(text, label, /(\d{15})/i);
        if (numero_imei_gps && numero_imei_gps.length === 15) {
          numero_imei_gps = numero_imei_gps.replace(/[^\d]/g, '');
          break;
        }
        // Si no encuentra exactamente 15, buscar 15+ dígitos
        if (!numero_imei_gps || numero_imei_gps.length !== 15) {
          numero_imei_gps = extractValueAfterLabel(text, label, /(\d{15,})/i);
          if (numero_imei_gps && numero_imei_gps.length >= 15) {
            // Tomar solo los primeros 15 dígitos si hay más
            numero_imei_gps = numero_imei_gps.replace(/[^\d]/g, '').substring(0, 15);
            break;
          }
        }
      }
      // Buscar números largos (15 dígitos) cerca de "IMEI" o "GPS"
      if (!numero_imei_gps || numero_imei_gps.length !== 15) {
        // Buscar IMEI seguido de 15 dígitos
        const imeiContext = text.match(/IMEI[:\s]*(\d{15})/i);
        if (imeiContext && imeiContext[1]) {
          numero_imei_gps = imeiContext[1].replace(/[^\d]/g, '');
        } else {
          // Buscar cualquier número de exactamente 15 dígitos consecutivos
          const match = text.match(/(\d{15})/);
          if (match && match[1]) {
            numero_imei_gps = match[1].replace(/[^\d]/g, '');
          }
        }
      }

      // Extraer Clase (EXCAVADORA, CARGADORA, etc.)
      // IMPORTANTE: Debe detenerse antes de títulos de otros campos como "IDENTIFICACIÓN"
      let clase = '';
      clase = extractValueAfterLabel(text, 'Clase', /([A-ZÁÉÍÓÚÑ\s]{3,30})/i);
      if (clase) {
        clase = clase.toUpperCase().trim();
        
        // Lista completa de stop words (misma que para descripción)
        const stopWords = [
          'IDENTIFICACIÓN', 'IDENTIFICACION', 'IDENTIF', 'IDENT',
          'NÚMERO ÚNICO', 'NUMERO UNICO', 'NÚMERO', 'NUMERO', 'NRO', 'NRO.',
          'SERIE', 'MARCA', 'MODELO', 'LÍNEA', 'LINEA', 'TIPO',
          'COLOR', 'CARROCERÍA', 'CARROCERIA', 'CABINA',
          'MAQUINARIA', 'EJES', 'LARGO', 'ALTO', 'ANCHO',
          'PESO', 'RODAJE', 'ESTADO', 'FECHA', 'MATRÍCULA', 'MATRICULA',
          'GPS', 'IMEI', 'EMPRESA', 'HABILITACIÓN', 'HABILITACION',
          'PROVEEDOR', 'NACIONAL', 'DISPOSITIVO', 'ORIGEN', 'REGISTRO',
          'CILINDRAJE', 'MOTOR', 'CHASIS', 'VIN', 'SUBPARTIDA'
        ];
        
        // Buscar la primera stop word y cortar antes de ella
        let minIndex = clase.length;
        for (const stopWord of stopWords) {
          // Buscar la palabra completa (con límites de palabra para evitar falsos positivos)
          const regex = new RegExp(`\\b${stopWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          const match = clase.match(regex);
          if (match && match.index !== undefined && match.index > 0) {
            if (match.index < minIndex) {
              minIndex = match.index;
            }
          }
          // También buscar sin límites de palabra (por si acaso)
          const simpleIndex = clase.indexOf(stopWord);
          if (simpleIndex > 0 && simpleIndex < minIndex) {
            minIndex = simpleIndex;
          }
        }
        
        // Si encontramos una stop word, cortar antes de ella
        if (minIndex < clase.length) {
          clase = clase.substring(0, minIndex).trim();
        }
        
        // Limpiar espacios múltiples
        clase = clase.replace(/\s+/g, ' ').trim();
        
        // Validar que tenga al menos 3 caracteres después de limpiar
        if (clase.length < 3) {
          clase = '';
        }
      }
      // Si no se encontró clase, usar descripción
      if (!clase && descripcion) {
        clase = descripcion;
      }
      // Patrones específicos para clases comunes
      if (!clase || clase.length < 3) {
        const claseMatch = text.match(/Clase[:\s]+(EXCAVADORA|CARGADORA|RETROEXCAVADORA|MOTONIVELADORA|COMPACTADORA|CAMIÓN|VOLQUETA|TRACTOR|GRÚA)/i);
        if (claseMatch && claseMatch[1]) {
          clase = claseMatch[1].toUpperCase();
        }
      }

      // Extraer Cilindraje (4249) - en cc (centímetros cúbicos)
      let cilindraje = '';
      const cilindrajeLabels = ['Cilindraje', 'Cilindrada'];
      for (const label of cilindrajeLabels) {
        cilindraje = extractValueAfterLabel(text, label, /(\d{3,})/i);
        if (cilindraje) {
          // Limpiar y validar que sea un número razonable (entre 100 y 50000 cc)
          const num = parseInt(cilindraje.replace(/[^\d]/g, ''));
          if (num >= 100 && num <= 50000) {
            cilindraje = num.toString();
            break;
          }
        }
      }
      if (!cilindraje) {
        const match = text.match(/Cilindraje[:\s]+(\d{3,})/i);
        if (match && match[1]) {
          const num = parseInt(match[1].replace(/[^\d]/g, ''));
          if (num >= 100 && num <= 50000) {
            cilindraje = num.toString();
          }
        }
      }

      // Extraer Nro. motor (A3351)
      // Nota: OCR puede confundir I con 1, O con 0
      let numero_motor = '';
      const motorLabels = [
        'Nro. motor',
        'Nro motor',
        'Número motor',
        'Número de motor',
        'Nro. de motor',
      ];
      for (const label of motorLabels) {
        numero_motor = extractValueAfterLabel(text, label, /([A-Z0-9I]{4,})/i);
        if (numero_motor && numero_motor.length >= 4) {
          numero_motor = numero_motor.toUpperCase().replace(/[^A-Z0-9I]/g, '');
          // Corregir errores comunes de OCR: I -> 1
          numero_motor = numero_motor.replace(/I/g, '1');
          break;
        }
      }
      if (!numero_motor || numero_motor.length < 4) {
        const match = text.match(/Nro\.?\s*motor[:\s]+([A-Z0-9I]{4,})/i);
        if (match && match[1]) {
          numero_motor = match[1].toUpperCase().replace(/[^A-Z0-9I]/g, '').trim();
          // Corregir errores comunes de OCR: I -> 1
          numero_motor = numero_motor.replace(/I/g, '1');
        }
      }

      // Extraer Nro. chasis (THEDAOLOL00002327)
      // Nota: OCR puede confundir O con 0, I con 1, L con 1
      let numero_chasis = '';
      const chasisLabels = [
        'Nro. chasis',
        'Nro chasis',
        'Número chasis',
        'Número de chasis',
        'Nro. de chasis',
        'Chasis',
      ];
      for (const label of chasisLabels) {
        numero_chasis = extractValueAfterLabel(text, label, /([A-Z0-9O]{8,})/i);
        if (numero_chasis && numero_chasis.length >= 8) {
          numero_chasis = numero_chasis.toUpperCase().replace(/[^A-Z0-9O]/g, '');
          // Corregir errores comunes de OCR: O en medio de números -> 0
          // Pero mantener O si es parte de una palabra (ej: THEDAOLOL)
          numero_chasis = numero_chasis.replace(/(\d)O(\d)/g, '$10$2'); // O entre números -> 0
          break;
        }
      }
      if (!numero_chasis || numero_chasis.length < 8) {
        const match = text.match(/Nro\.?\s*chasis[:\s]+([A-Z0-9O]{8,})/i);
        if (match && match[1]) {
          numero_chasis = match[1].toUpperCase().replace(/[^A-Z0-9O]/g, '').trim();
          // Corregir errores comunes de OCR: O en medio de números -> 0
          numero_chasis = numero_chasis.replace(/(\d)O(\d)/g, '$10$2');
        }
      }

      // Extraer Subpartida arancelaria (8429520000) - 10 dígitos
      let subpartida_arancelaria = '';
      const subpartidaLabels = [
        'Subpartida arancelaria',
        'Subpartida',
        'Partida arancelaria',
      ];
      for (const label of subpartidaLabels) {
        subpartida_arancelaria = extractValueAfterLabel(text, label, /(\d{8,})/i);
        if (subpartida_arancelaria && subpartida_arancelaria.length >= 8) {
          subpartida_arancelaria = subpartida_arancelaria.replace(/[^\d]/g, '');
          break;
        }
      }
      if (!subpartida_arancelaria || subpartida_arancelaria.length < 8) {
        const match = text.match(/Subpartida\s*arancelaria[:\s]+(\d{8,})/i);
        if (match && match[1]) {
          subpartida_arancelaria = match[1].replace(/[^\d]/g, '').trim();
        }
      }

      // Extraer Rodaje (ORUGAS, LLANTAS, etc.)
      // Según el RUNT, después de Rodaje viene "Fecha matrícula inicial"
      let rodaje = '';
      rodaje = extractValueAfterLabel(text, 'Rodaje', /([A-ZÁÉÍÓÚÑ\s]{3,20})/i);
      if (rodaje) {
        rodaje = rodaje.toUpperCase().trim();
        // Detener en palabras clave (FECHA MATRICULA, ESTADO, etc.)
        const stopWords = [
          'FECHA', 'MATRICULA', 'MATRÍCULA', 'MATRICU', 'INICIAL',
          'ESTADO', 'VEHICULO', 'VEHÍCULO', 'EMPRESA', 'GPS', 
          'NRO', 'NRO.', 'NÚMERO', 'NUMERO', 'ORIGEN', 'REGISTRO'
        ];
        for (const stopWord of stopWords) {
          const stopIndex = rodaje.indexOf(stopWord);
          if (stopIndex > 0) {
            rodaje = rodaje.substring(0, stopIndex).trim();
            break;
          }
        }
        rodaje = rodaje.replace(/\s+/g, ' ').trim();
      }
      if (!rodaje || rodaje.length < 3) {
        // Buscar patrones específicos de rodaje, deteniendo antes de "Fecha"
        const match = text.match(/Rodaje[:\s]+(ORUGAS|LLANTAS|RUEDAS|NEUMÁTICOS|NEUMATICOS)(?:\s|$|\n|FECHA|MATRICU|ESTADO|VEHICULO|ORIGEN)/i);
        if (match && match[1]) {
          rodaje = match[1].toUpperCase().trim();
        } else {
          // Buscar sin restricciones pero limpiar después
          const match2 = text.match(/Rodaje[:\s]+(ORUGAS|LLANTAS|RUEDAS|NEUMÁTICOS|NEUMATICOS)/i);
          if (match2 && match2[1]) {
            rodaje = match2[1].toUpperCase().trim();
            // Limpiar cualquier texto adicional
            const stopWords = ['FECHA', 'MATRICULA', 'MATRÍCULA', 'MATRICU', 'INICIAL', 'ESTADO', 'ORIGEN'];
            for (const stopWord of stopWords) {
              const stopIndex = rodaje.indexOf(stopWord);
              if (stopIndex > 0) {
                rodaje = rodaje.substring(0, stopIndex).trim();
                break;
              }
            }
          }
        }
      }

      // Extraer Estado del vehículo (REGISTRADO, ACTIVO, etc.)
      let estado_vehiculo = '';
      const estadoLabels = [
        'Estado del vehiculo',
        'Estado del vehículo',
        'Estado vehiculo',
        'Estado vehículo',
        'Estado',
      ];
      for (const label of estadoLabels) {
        estado_vehiculo = extractValueAfterLabel(text, label, /([A-ZÁÉÍÓÚÑ\s]{3,20})/i);
        if (estado_vehiculo) {
          estado_vehiculo = estado_vehiculo.toUpperCase().trim();
          // Detener en palabras clave (NRO, ORIGEN, REGISTRO, etc.)
          const stopWords = [
            'NRO', 'NRO.', 'NÚMERO', 'NUMERO', 'IDENTIFICACIÓN', 'IDENTIFICACION',
            'ORIGEN', 'REGISTRO', 'EMPRESA', 'GPS', 'HABILITACIÓN', 'DISPOSITIVO', 
            'PROVEEDOR', 'NACIONAL', 'IMEI', 'SERIE'
          ];
          for (const stopWord of stopWords) {
            const stopIndex = estado_vehiculo.indexOf(stopWord);
            if (stopIndex > 0) {
              estado_vehiculo = estado_vehiculo.substring(0, stopIndex).trim();
              break;
            }
          }
          estado_vehiculo = estado_vehiculo.replace(/\s+/g, ' ').trim();
          if (estado_vehiculo.length >= 3) break;
        }
      }
      if (!estado_vehiculo || estado_vehiculo.length < 3) {
        // Buscar específicamente REGISTRADO, ACTIVO, etc., deteniendo antes de "Origen" o "Nro"
        const match = text.match(/Estado\s*del\s*veh[íi]culo[:\s]+(REGISTRADO|ACTIVO|INACTIVO|EN\s*TRÁMITE|PENDIENTE)(?:\s|$|\n|ORIGEN|NRO|NÚMERO|EMPRESA|GPS)/i);
        if (match && match[1]) {
          estado_vehiculo = match[1].toUpperCase().trim();
        } else {
          // Buscar sin restricciones pero limpiar después
          const match2 = text.match(/Estado\s*del\s*veh[íi]culo[:\s]+(REGISTRADO|ACTIVO|INACTIVO|EN\s*TRÁMITE|PENDIENTE)/i);
          if (match2 && match2[1]) {
            estado_vehiculo = match2[1].toUpperCase().trim();
            // Limpiar cualquier texto adicional después del estado
            const stopWords = ['NRO', 'NRO.', 'NÚMERO', 'NUMERO', 'ORIGEN', 'REGISTRO', 'EMPRESA', 'GPS'];
            for (const stopWord of stopWords) {
              const stopIndex = estado_vehiculo.indexOf(stopWord);
              if (stopIndex > 0) {
                estado_vehiculo = estado_vehiculo.substring(0, stopIndex).trim();
                break;
              }
            }
          } else {
            // Buscar solo la palabra REGISTRADO cerca de "Estado"
            const match3 = text.match(/Estado[:\s]+(REGISTRADO|ACTIVO|INACTIVO)/i);
            if (match3 && match3[1]) {
              estado_vehiculo = match3[1].toUpperCase().trim();
            }
          }
        }
      }

      // Extraer Empresa de habilitación del GPS (RASTRACK S.A.S)
      let empresa_gps = '';
      const empresaGpsLabels = [
        'Empresa de habilitación del Dispositivo GPS de proveedor Nacional',
        'Empresa de habilitación del Dispositivo GPS',
        'Empresa de habilitación GPS',
        'Empresa GPS de proveedor nacional',
        'Empresa GPS',
        'Empresa de GPS',
        'Empresa',
      ];
      for (const label of empresaGpsLabels) {
        // Buscar texto que contenga letras, espacios y puntos (para S.A.S)
        empresa_gps = extractValueAfterLabel(text, label, /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.]{2,40})/i);
        if (empresa_gps) {
          empresa_gps = empresa_gps.toUpperCase().trim();
          // Limpiar espacios múltiples pero mantener puntos (para S.A.S)
          empresa_gps = empresa_gps.replace(/\s+/g, ' ').trim();
          // Detener en palabras clave que no son parte del nombre
          const stopWords = ['PROVEEDOR', 'NACIONAL', 'HABILITACIÓN', 'DISPOSITIVO', 'GPS'];
          for (const stopWord of stopWords) {
            const stopIndex = empresa_gps.indexOf(stopWord);
            if (stopIndex > 0 && stopIndex < empresa_gps.length - 5) {
              // Solo detener si no es al final (puede ser parte del nombre)
              empresa_gps = empresa_gps.substring(0, stopIndex).trim();
              break;
            }
          }
          // Validar que tenga formato de empresa (puede terminar en S.A.S, S.A., LTDA, etc.)
          if (empresa_gps.length >= 3 && /[A-ZÁÉÍÓÚÑ]/.test(empresa_gps)) {
            break;
          }
        }
      }
      if (!empresa_gps || empresa_gps.length < 3) {
        // Buscar patrones comunes de empresas (S.A.S, S.A., LTDA, etc.) - específicamente RASTRACK S.A.S
        const match = text.match(/Empresa[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.]{2,40}(?:S\.A\.S|S\.A\.|LTDA|INC)?)/i);
        if (match && match[1]) {
          empresa_gps = match[1].toUpperCase().trim().replace(/\s+/g, ' ');
        } else {
          // Buscar específicamente RASTRACK S.A.S
          const match2 = text.match(/(RASTRACK\s*S\.A\.S)/i);
          if (match2 && match2[1]) {
            empresa_gps = match2[1].toUpperCase().replace(/\s+/g, ' ');
          }
        }
      }

      return {
        text,
        serie,
        descripcion,
        marca,
        linea,
        modelo,
        ancho,
        alto,
        largo,
        peso,
        numero_identificacion: numero_identificacion || '',
        numero_serie_gps: numero_serie_gps || '',
        numero_imei_gps: numero_imei_gps || '',
        clase: clase || '',
        cilindraje: cilindraje || '',
        numero_motor: numero_motor || '',
        numero_chasis: numero_chasis || '',
        subpartida_arancelaria: subpartida_arancelaria || '',
        rodaje: rodaje || '',
        estado_vehiculo: estado_vehiculo || '',
        empresa_gps: empresa_gps || '',
      };
    } catch (error) {
      console.error('Error en OCR RUNT:', error);
      throw error;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return {
    extractDataFromRUNT,
    isProcessing,
    progress,
  };
};

 