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
      const seriePatterns = [
        /Nro\.\s*serie[:\s]*([A-Z0-9\-]{5,})/i, // Priorizar "Nro. serie" con mínimo 5 caracteres
        /Número\s*único\s*de\s*identificación[:\s]*([A-Z0-9\-]{5,})/i,
        /Nro\.\s*de\s*identificación[:\s]*([A-Z0-9\-]{5,})/i,
        /Nro\.\s*serie[:\s]*([A-Z0-9]{8,})/i, // Formato largo como HCMDEPA1V00072991
        /(HCMDEPA[0-9A-Z]{8,})/i, // Formato específico Hitachi
        /(MC\d{6,})/i, // Formato MC seguido de números
        /serie[:\s]*([A-Z0-9\-]{5,})/i,
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

      // Patrones para línea (ej: ZX75USK-5B)
      const lineaPatterns = [
        /Linea[:\s]+([A-Z0-9\-]{3,30})(?:\n|Tipo|Modelo|Color|$)/i,
        /Línea[:\s]+([A-Z0-9\-]{3,30})(?:\n|Tipo|Modelo|Color|$)/i,
        /Linea[:\s]+(ZX\d+[A-Z\-0-9]+)/i, // Formato específico ZX75USK-5B
        /(ZX\d+[A-Z\-0-9]+)/i, // Buscar cualquier patrón ZX seguido de números y letras
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
      let serie = '';
      // Primero intentar con el método de extracción después de etiqueta
      // Buscar "Nro. serie" o variaciones
      const serieLabels = ['Nro. serie', 'Nro serie', 'Número serie', 'Nro. de serie'];
      for (const label of serieLabels) {
        serie = extractValueAfterLabel(text, label, /([A-Z0-9\-]{8,})/i);
        if (!serie || serie.length < 8) {
          // Intentar sin patrón específico
          serie = extractValueAfterLabel(text, label);
          if (serie) {
            serie = serie.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
            if (serie.length >= 8) break;
          }
        } else {
          break;
        }
      }
      
      // Si aún no hay serie, usar patrones regex
      if (!serie || serie.length < 5) {
        for (const pattern of seriePatterns) {
          const matches = [...text.matchAll(new RegExp(pattern.source, 'gi'))];
          for (const match of matches) {
            if (match[1]) {
              const candidate = match[1].trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
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
      let descripcion = '';
      descripcion = extractValueAfterLabel(text, 'Clase', /([A-ZÁÉÍÓÚÑ\s]{3,25})/i);
      if (descripcion) {
        descripcion = descripcion.toUpperCase().replace(/\s+/g, ' ').trim();
        // Detener en palabras clave
        const stopWords = ['MARCA', 'LINEA', 'MODELO', 'TIPO'];
        for (const stopWord of stopWords) {
          const stopIndex = descripcion.indexOf(stopWord);
          if (stopIndex > 0) {
            descripcion = descripcion.substring(0, stopIndex).trim();
            break;
          }
        }
      }
      if (!descripcion || descripcion.length < 3) {
        for (const pattern of descripcionPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            descripcion = match[1].trim().toUpperCase();
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
      linea = extractValueAfterLabel(text, 'Linea', /([A-Z0-9\-]{3,30})/i);
      if (!linea || linea.length < 3) {
        linea = extractValueAfterLabel(text, 'Línea', /([A-Z0-9\-]{3,30})/i);
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
        linea = linea.replace(/\s+/g, '').replace(/[^A-Z0-9\-]/g, '');
      }
      if (!linea || linea.length < 3) {
        for (const pattern of lineaPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            linea = match[1].trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9\-]/g, '');
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
      let alto = '';
      const altoValue = extractValueAfterLabel(text, 'Alto', /(\d+[.,]\d+|\d{3,})/i);
      if (altoValue) {
        const cleanValue = altoValue.replace(/[^\d.,]/g, '').replace(',', '.');
        alto = mmToMeters(cleanValue);
      }
      if (!alto) {
        for (const pattern of altoPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = match[1].replace(',', '.').replace(/[^\d.]/g, '');
            alto = mmToMeters(value);
            if (alto) break;
          }
        }
      }

      // Extraer largo (convertir mm a metros si es necesario)
      let largo = '';
      const largoValue = extractValueAfterLabel(text, 'Largo', /(\d+[.,]\d+|\d{3,})/i);
      if (largoValue) {
        const cleanValue = largoValue.replace(/[^\d.,]/g, '').replace(',', '.');
        largo = mmToMeters(cleanValue);
      }
      if (!largo) {
        for (const pattern of largoPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = match[1].replace(',', '.').replace(/[^\d.]/g, '');
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

