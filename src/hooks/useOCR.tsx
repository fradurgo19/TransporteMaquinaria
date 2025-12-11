import { useState } from 'react';
import Tesseract from 'tesseract.js';

interface OCRResult {
  text: string;
  gallons: string; // Volumen en galones (convertido de litros si es necesario)
  cost: string; // Costo total
  pricePerGallon: string; // Precio por galón (convertido de precio por litro si es necesario)
  date: string;
  vehiclePlate?: string; // Placa del vehículo
  kilometers?: string; // Kilómetros del odómetro
  fuelType?: string; // Tipo de combustible (DIESEL, GASOLINA, etc.)
}

export const useOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const extractDataFromReceipt = async (imageFile: File): Promise<OCRResult> => {
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

      console.log('📝 Texto extraído:', text);

      // Patrones mejorados para extraer volumen (puede estar en litros o galones)
      // Múltiples formatos: "Volumen:", "CANT:", "Cantidad:", etc.
      const volumePatterns = [
        // Formato: "Volumen: 15.841" o "Volumen 15.841" (PRIORITARIO)
        /volumen[:\s]+(\d+[.,]\d+)/i,
        /volumen[:\s]*(\d+[.,]\d+)/i,
        /vol[:\s]+(\d+[.,]\d+)/i,
        /vol[:\s]*(\d+[.,]\d+)/i,
        // Formato: "CANT: 15.841" o "CANT 15.841" o "Cantidad: 15.841"
        /cant[:\s]+(\d+[.,]\d+)/i,
        /cant[:\s]*(\d+[.,]\d+)/i,
        /cantidad[:\s]+(\d+[.,]\d+)/i,
        /cantidad[:\s]*(\d+[.,]\d+)/i,
        // Formato con galones explícitos
        /(\d+[.,]\d+)\s*gal/i,
        /galones?[:\s]*(\d+[.,]\d+)/i,
        /gal[:\s]*(\d+[.,]\d+)/i,
        // Formato con litros explícitos
        /(\d+[.,]\d+)\s*l/i,
        /litros?[:\s]*(\d+[.,]\d+)/i,
        /l[:\s]*(\d+[.,]\d+)/i,
        // Formato genérico: número decimal después de "CANT" o "VOLUMEN"
        /(?:cant|volumen|vol)[:\s]*(\d+[.,]\d+)/i,
      ];

      // Patrones mejorados para extraer costo total (VALOR TANQUEO)
      // Múltiples formatos: "VALOR:", "TOTAL:", "VALOR TOTAL:", etc.
      const costPatterns = [
        // Formato: "VALOR: $177261" o "VALOR $177261" (PRIORITARIO)
        /valor[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /valor[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato: "TOTAL: $177261" o "TOTAL $177261" (PRIORITARIO)
        /total[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /total[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato: "VALOR TOTAL: $177261" o "VALOR TOTAL $177261"
        /valor\s+total[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /valor\s+total[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato: "$177261" después de "VALOR" o "TOTAL"
        /(?:valor|total)[:\s]*.*?\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato general con símbolo de peso (solo si no se encontró VALOR/TOTAL)
        /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/,
        // Formato con COP
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*cop/i,
        // Números grandes (último recurso, solo si es razonable)
        /(\d{5,}[.,]?\d*)/,
      ];

      // Patrones mejorados para extraer precio unitario (por litro o galón)
      // Formato Gigante: "Precio: $11190" (a la derecha del campo)
      const pricePerUnitPatterns = [
        // Formato colombiano: "Precio: $11190" o "Precio $11190" (PRIORITARIO)
        /precio[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /precio[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /precio\s*unitario[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /valor\s*unitario[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato con /gal o /l
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*\/?\s*gal/i,
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*\/?\s*l/i,
        /gal[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /l[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
      ];

      // Patrones mejorados para extraer fecha
      const datePatterns = [
        // Formato colombiano: "2025/11/20" o "2025-11-20"
        /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
        // Formato: "F. Emision: 2025/11/20" o "Fecha factura: 2025/11/20"
        /(?:f\.?\s*emision|fecha\s*factura|fecha)[:\s]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        // Formato DD/MM/YYYY o DD-MM-YYYY
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
        // Formato con mes en texto
        /(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+\d{2,4})/i,
      ];

      // Patrones para extraer placa del vehículo
      const platePatterns = [
        // Formato colombiano: "Placa: NHW808" o "Placa NHW808"
        /placa[:\s]*([A-Z]{3}\d{3})/i,
        /placa[:\s]*([A-Z]{2,3}\d{2,4})/i,
        // Formato general: 3 letras + 3 números
        /\b([A-Z]{3}\d{3})\b/,
        // Formato: 2-3 letras + 2-4 números
        /\b([A-Z]{2,3}\d{2,4})\b/,
      ];

      // Patrones para extraer kilómetros
      const kilometersPatterns = [
        // Formato colombiano: "Kilometros: 0" o "Kilometros 0"
        /kilometros?[:\s]*(\d+)/i,
        /kms?[:\s]*(\d+)/i,
        /km[:\s]*(\d+)/i,
      ];

      // Patrones para extraer tipo de combustible
      const fuelTypePatterns = [
        /combustible[:\s]*([A-Z]+)/i,
        /(diesel|gasolina|acpm|premium|corriente)/i,
      ];

      // Extraer volumen (puede estar en litros o galones)
      // Múltiples formatos: "Volumen:", "CANT:", "Cantidad:", etc.
      // Generalmente en litros en facturas colombianas y debe convertirse a galones
      let volume = '';
      let isLiters = false;
      
      for (const pattern of volumePatterns) {
        const match = text.match(pattern);
        if (match) {
          volume = match[1].replace(',', '.');
          // Detectar si es litros o galones
          const matchText = match[0].toLowerCase();
          if (matchText.includes('gal')) {
            isLiters = false; // Es galones explícitamente
          } else if (matchText.includes('l') && !matchText.includes('gal')) {
            isLiters = true; // Es litros explícitamente
          } else {
            // Si no especifica unidad, verificar el contexto
            // Si dice "CANT" o "Volumen" sin unidad, generalmente es litros en Colombia
            // Buscar en el texto cercano si hay indicación de litros
            const contextText = text.toLowerCase();
            const volumeIndex = contextText.indexOf(match[0].toLowerCase());
            const contextAround = contextText.substring(
              Math.max(0, volumeIndex - 50),
              Math.min(contextText.length, volumeIndex + 50)
            );
            
            if (contextAround.includes('litro') || contextAround.includes(' l ') || contextAround.includes('lts')) {
              isLiters = true;
            } else if (contextAround.includes('galon') || contextAround.includes(' gal ')) {
              isLiters = false;
            } else {
              // Por defecto, asumir litros (formato común en facturas colombianas)
              isLiters = true;
            }
          }
          console.log('📊 Volumen extraído:', volume, isLiters ? 'litros' : 'galones', `(patrón: ${match[0]})`);
          break;
        }
      }

      // Convertir litros a galones si es necesario (1 galón = 3.78541 litros)
      let gallons = '';
      if (volume) {
        const volumeNum = parseFloat(volume);
        if (isLiters) {
          gallons = (volumeNum / 3.78541).toFixed(3);
          console.log(`📊 Conversión: ${volume} litros = ${gallons} galones`);
        } else {
          gallons = volume;
        }
      }

      // Extraer costo total (VALOR TANQUEO) - Priorizar campo "TOTAL:"
      let cost = '';
      let totalFound = false;
      
      // Primero buscar específicamente el campo "VALOR:", "TOTAL:" o "VALOR TOTAL:"
      const totalFieldPatterns = [
        // Formato: "VALOR: $177261" o "VALOR $177261" (PRIORITARIO)
        /valor[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /valor[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato: "TOTAL: $177261" o "TOTAL $177261" (PRIORITARIO)
        /total[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /total[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        // Formato: "VALOR TOTAL: $177261" o "VALOR TOTAL $177261"
        /valor\s+total[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /valor\s+total[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
      ];
      
      for (const pattern of totalFieldPatterns) {
        const match = text.match(pattern);
        if (match) {
          let costValue = match[1].replace(/\./g, '').replace(',', '.');
          // Si no tiene decimales, puede ser un número grande sin separadores
          if (!costValue.includes('.')) {
            costValue = match[1].replace(/[.,]/g, '');
          }
          const costNum = parseFloat(costValue);
          // Filtrar valores razonables (más de $1,000 y menos de $10,000,000)
          if (costNum >= 1000 && costNum <= 10000000) {
            cost = costValue;
            totalFound = true;
            console.log('✅ Valor total encontrado en campo TOTAL:', cost);
            break;
          }
        }
      }
      
      // Si no se encontró en el campo TOTAL, buscar en otros patrones
      if (!totalFound) {
        for (const pattern of costPatterns) {
          const match = text.match(pattern);
          if (match) {
            let costValue = match[1].replace(/\./g, '').replace(',', '.');
            if (!costValue.includes('.')) {
              costValue = match[1].replace(/[.,]/g, '');
            }
            const costNum = parseFloat(costValue);
            // Filtrar valores razonables (más de $1,000 y menos de $10,000,000)
            if (costNum >= 1000 && costNum <= 10000000) {
              cost = costValue;
              console.log('✅ Valor total encontrado en patrón alternativo:', cost);
              break;
            }
          }
        }
      }
      
      // Si aún no se encontró el TOTAL, intentar calcular desde volumen × precio
      // (último recurso: Volumen × Precio = Total)
      if (!cost && volume && pricePerUnit) {
        const volumeNum = parseFloat(volume);
        const priceNum = parseFloat(pricePerUnit);
        if (volumeNum > 0 && priceNum > 0) {
          const calculatedCost = (volumeNum * priceNum).toFixed(0);
          cost = calculatedCost;
          console.log(`📊 Valor total calculado: ${volume} × ${pricePerUnit} = ${cost}`);
        }
      }

      // Extraer precio unitario (por litro o galón)
      let pricePerUnit = '';
      let isPricePerLiter = false;
      for (const pattern of pricePerUnitPatterns) {
        const match = text.match(pattern);
        if (match) {
          let priceValue = match[1].replace(/\./g, '').replace(',', '.');
          if (!priceValue.includes('.')) {
            priceValue = match[1].replace(/[.,]/g, '');
          }
          const priceNum = parseFloat(priceValue);
          // Filtrar valores razonables (más de $1,000 y menos de $50,000 por unidad)
          if (priceNum >= 1000 && priceNum <= 50000) {
            pricePerUnit = priceValue;
            // Detectar si es precio por litro
            const matchText = match[0].toLowerCase();
            if (matchText.includes('/l') || matchText.includes(' l')) {
              isPricePerLiter = true;
            }
            break;
          }
        }
      }

      // Convertir precio por litro a precio por galón si es necesario
      let pricePerGallon = '';
      if (pricePerUnit) {
        const priceNum = parseFloat(pricePerUnit);
        if (isPricePerLiter) {
          pricePerGallon = (priceNum * 3.78541).toFixed(2);
        } else {
          pricePerGallon = pricePerUnit;
        }
      }

      // Si no se encontró precio unitario directamente, calcularlo si tenemos costo y volumen
      if (!pricePerGallon && gallons && cost) {
        const gallonsNum = parseFloat(gallons);
        const costNum = parseFloat(cost);
        if (gallonsNum > 0 && costNum > 0) {
          pricePerGallon = (costNum / gallonsNum).toFixed(2);
        }
      }
      
      // Si aún no se encontró el TOTAL, intentar calcular desde volumen × precio
      // (último recurso: Volumen × Precio = Total)
      if (!cost && volume && pricePerUnit) {
        const volumeNum = parseFloat(volume);
        const priceNum = parseFloat(pricePerUnit);
        if (volumeNum > 0 && priceNum > 0) {
          const calculatedCost = (volumeNum * priceNum).toFixed(0);
          cost = calculatedCost;
          console.log(`📊 Valor total calculado: ${volume} × ${pricePerUnit} = ${cost}`);
        }
      }

      // Extraer fecha (priorizar formato YYYY/MM/DD)
      let date = '';
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          date = match[1] || match[0];
          // Si el formato es YYYY/MM/DD, mantenerlo así
          if (date.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/)) {
            break;
          }
          // Si no, intentar el siguiente patrón
        }
      }

      // Extraer placa del vehículo
      let vehiclePlate = '';
      for (const pattern of platePatterns) {
        const match = text.match(pattern);
        if (match) {
          vehiclePlate = match[1].toUpperCase();
          break;
        }
      }

      // Extraer kilómetros
      let kilometers = '';
      for (const pattern of kilometersPatterns) {
        const match = text.match(pattern);
        if (match) {
          kilometers = match[1];
          break;
        }
      }

      // Extraer tipo de combustible
      let fuelType = '';
      for (const pattern of fuelTypePatterns) {
        const match = text.match(pattern);
        if (match) {
          fuelType = match[1].toUpperCase();
          break;
        }
      }

      console.log('📊 Datos extraídos del OCR:', {
        volume,
        isLiters,
        gallons,
        cost,
        pricePerUnit,
        isPricePerLiter,
        pricePerGallon,
        date,
        vehiclePlate,
        kilometers,
        fuelType,
      });

      return {
        text,
        gallons,
        cost,
        pricePerGallon,
        date,
        vehiclePlate: vehiclePlate || undefined,
        kilometers: kilometers || undefined,
        fuelType: fuelType || undefined,
      };
    } catch (error) {
      console.error('Error en OCR:', error);
      throw error;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return {
    extractDataFromReceipt,
    isProcessing,
    progress,
  };
};

