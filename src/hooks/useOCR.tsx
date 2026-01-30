import { useState } from 'react';
import Tesseract from 'tesseract.js';

interface OCRResult {
  text: string;
  gallons: string;
  cost: string;
  pricePerGallon: string;
  date: string;
  vehiclePlate?: string;
  kilometers?: string;
  fuelType?: string;
  gasStationName?: string; // Estación de servicio (parte superior de la tirilla)
}

/** Parsea valor numérico: 1.234,56 (CO) o 1,234.56 (US) o 123456 */
function parseMoney(raw: string): { value: string; num: number } | null {
  const s = raw.trim().replace(/\s/g, '');
  const lastC = s.lastIndexOf(',');
  const lastD = s.lastIndexOf('.');
  let normalized: string;
  if (lastC >= 0 && lastD >= 0) {
    normalized = lastC > lastD
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (lastC >= 0) {
    const after = s.slice(lastC + 1);
    normalized = (after.length === 3 && /^\d+$/.test(after)) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else {
    normalized = s;
  }
  const num = parseFloat(normalized);
  if (Number.isNaN(num) || num < 0) return null;
  return { value: normalized, num };
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

      console.log('📝 Texto extraído (OCR):', text);

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const textLower = text.toLowerCase();

      // ---- ESTACIÓN DE SERVICIO (parte superior de la tirilla) ----
      const skipStation = /^(tel|nit|factura|dfep|f\.?\s*emision|fecha|placa|cliente|vendido|autorizacion|resolucion|calle|\d+\s*[-\.]\s*\d|^\d+$)/i;
      let gasStationName = '';
      for (let i = 0; i < Math.min(12, lines.length); i++) {
        const line = lines[i];
        if (!line || line.length < 2) continue;
        if (skipStation.test(line)) continue;
        // Evitar líneas que son solo números o códigos cortos
        if (/^\d[\d\s\-\.\/]*$/.test(line) || line.length < 3) continue;
        // La estación suele ser de 2–6 palabras, sin "total", "valor", etc.
        if (/\b(total|valor|precio|galon|litro|placa|nit|iva)\b/i.test(line)) continue;
        gasStationName = line.replace(/\s+/g, ' ').trim();
        if (gasStationName.length >= 2 && gasStationName.length <= 120) break;
      }

      // ---- GALONES: "Volumen" (valor a la derecha) O "GL" (valor abajo) ----
      const volumePatterns: RegExp[] = [
        /volumen[:\s]+(\d+[.,]\d+)/i,
        /volumen[:\s]*(\d+[.,]\d+)/i,
        /vol[:\s]+(\d+[.,]\d+)/i,
        /vol[:\s]*(\d+[.,]\d+)/i,
        /cant[:\s]+(\d+[.,]\d+)/i,
        /cantidad[:\s]+(\d+[.,]\d+)/i,
        /(\d+[.,]\d+)\s*gal\b/i,
        /galones?[:\s]*(\d+[.,]\d+)/i,
        /gal[:\s]+(\d+[.,]\d+)/i,
        /(\d+[.,]\d+)\s*l\b/i,
        /litros?[:\s]*(\d+[.,]\d+)/i,
        /(?:cant|volumen|vol)[:\s]*(\d+[.,]\d+)/i,
      ];
      // GL con valor abajo (misma línea o siguiente) — Terpel, etc.
      const glBelowPattern = /\bGL\b[\s\n]*(\d+[.,]\d+)/i;
      volumePatterns.push(glBelowPattern);

      let volume = '';
      let isLiters = false;

      for (const p of volumePatterns) {
        const m = text.match(p);
        if (m) {
          volume = m[1].replace(',', '.');
          const mt = m[0].toLowerCase();
          if (mt.includes('gal') || p === glBelowPattern) {
            isLiters = false;
          } else if (/l\b|litro/.test(mt) && !mt.includes('gal')) {
            isLiters = true;
          } else {
            const idx = textLower.indexOf(m[0].toLowerCase());
            const ctx = textLower.slice(Math.max(0, idx - 60), idx + 80);
            isLiters = /litro|lts|\bl\b/.test(ctx) && !/galon|gal\b/.test(ctx);
          }
          console.log('📊 Volumen:', volume, isLiters ? 'L' : 'GL', p.source);
          break;
        }
      }

      if (!volume && /\bGL\b/i.test(text)) {
        const gl = text.match(glBelowPattern);
        if (gl) {
          volume = gl[1].replace(',', '.');
          isLiters = false;
          console.log('📊 Volumen (GL abajo):', volume);
        }
      }

      let gallons = '';
      if (volume) {
        const v = parseFloat(volume);
        gallons = isLiters ? (v / 3.78541).toFixed(3) : volume;
      }

      // ---- FECHA TANQUEO: "Fecha factura" / "F. Emision" / "Fecha y hora generación" o expedición ----
      const datePatterns: RegExp[] = [
        /(?:fecha\s+y\s+hora\s+de?\s*(?:generacion|expedicion)|fecha\s+factura|f\.?\s*emision|fecha\s*factura)[:\s]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/i,
        /(?:fecha\s+y\s+hora\s+de?\s*(?:generacion|expedicion)|fecha\s+factura|f\.?\s*emision)[:\s]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
        /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/,
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
        /(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+\d{2,4})/i,
      ];
      let date = '';
      for (const p of datePatterns) {
        const m = text.match(p);
        if (m) {
          const d = (m[1] || m[0]).trim();
          date = d.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?.*$/, '').trim();
          if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(date) || /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(date)) break;
        }
      }

      // ---- PRECIO UNITARIO (ej. Precio: $11190 en tirillas tipo Gigante) ----
      const pricePatterns: RegExp[] = [
        /precio[:\s]*\$?\s*(\d+)/i,   // Precio: $11190 sin separador de miles
        /precio[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/i,
        /(?:vr\.?\s*unitario|valor\s*unitario|cant\.?\s*vr\.?\s*unitario)[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)\s*\/?\s*gal\b/i,
        /gal[:\s]*\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)\s*\/?\s*l\b/i,
      ];
      let pricePerUnit = '';
      let isPricePerLiter = false;
      for (const p of pricePatterns) {
        const m = text.match(p);
        if (m) {
          const raw = (m[1] || '').replace(/\s/g, '');
          const parsed = parseMoney(raw);
          if (parsed && parsed.num >= 1000 && parsed.num <= 100000) {
            pricePerUnit = parsed.value;
            const mt = m[0].toLowerCase();
            isPricePerLiter = !!(/\/l\b|\bl\b/.test(mt) && !/gal/.test(mt));
            break;
          }
        }
      }

      let pricePerGallon = '';
      if (pricePerUnit) {
        const n = parseFloat(pricePerUnit);
        pricePerGallon = isPricePerLiter ? (n * 3.78541).toFixed(2) : n.toFixed(2);
      }

      // ---- VALOR TANQUEO (TOTAL) ----
      // Tirillas tipo Gigante/Terpel: "TOTAL: $177261" o "TOTAL $177261" (sin separador de miles).
      // Prioridad: Total a Pagar > TOTAL: $N > Total/Valor con número flexible.
      const totalAPagarPatterns = [
        /total\s+a\s+pagar[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
        /total\s+a\s+pagar[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
      ];
      // TOTAL con número sin separadores (ej. TOTAL: $177261) — muy común en tirillas colombianas
      const totalSimplePatterns = [
        /total[:\s]*\$?\s*(\d+)/i,
        /total[:\s]+\$?\s*(\d+)/i,
        /totai[:\s]*\$?\s*(\d+)/i,   // OCR suele confundir L con I
        /tota1[:\s]*\$?\s*(\d+)/i,   // OCR suele confundir L con 1
      ];
      const totalPatterns = [
        /total[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
        /total[:\s]+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
        /valor\s*tanqueo[:\s]*\$?\s*(\d+)/i,
        /valor[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
        /valor\s+total[:\s]+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)/i,
      ];
      let cost = '';
      const tryCost = (m: RegExpMatchArray, label: string): boolean => {
        const raw = m[1].replace(/\s/g, '');
        const parsed = parseMoney(raw);
        if (!parsed) return false;
        if (parsed.num >= 1000 && parsed.num <= 20000000) {
          cost = parsed.value;
          console.log('✅ Valor tanqueo:', cost, label);
          return true;
        }
        if (parsed.num >= 100 && parsed.num <= 20000000 && /total|valor/i.test(m[0])) {
          cost = parsed.value;
          console.log('✅ Valor tanqueo:', cost, label);
          return true;
        }
        return false;
      };
      for (const p of totalAPagarPatterns) {
        const m = text.match(p);
        if (m && tryCost(m, 'Total a Pagar')) break;
      }
      if (!cost) {
        for (const p of totalSimplePatterns) {
          const m = text.match(p);
          if (m && tryCost(m, 'TOTAL')) break;
        }
      }
      if (!cost) {
        const tail = text.slice(-Math.max(800, Math.floor(text.length * 0.35)));
        for (const p of totalPatterns) {
          const m = tail.match(p);
          if (m && tryCost(m, 'Total/Valor')) break;
        }
      }
      if (!cost) {
        for (const p of totalPatterns) {
          const m = text.match(p);
          if (m && tryCost(m, 'Total/Valor (full)')) break;
        }
      }

      if (!cost && volume && pricePerUnit) {
        const v = parseFloat(volume);
        const p = parseFloat(pricePerUnit);
        if (v > 0 && p > 0) {
          cost = (v * p).toFixed(0);
          console.log('📊 Costo calculado: volumen × precio =', cost);
        }
      }
      if (!pricePerGallon && gallons && cost) {
        const g = parseFloat(gallons);
        const c = parseFloat(cost);
        if (g > 0 && c > 0) pricePerGallon = (c / g).toFixed(2);
      }

      // ---- PLACA, KILÓMETROS, COMBUSTIBLE ----
      const plateMatch = text.match(/placa[:\s]*([A-Za-z]{2,3}\d{2,4})/i);
      const vehiclePlate = plateMatch ? plateMatch[1].toUpperCase() : undefined;
      const kmMatch = text.match(/kilometros?[:\s]*(\d+)/i) || text.match(/\bkm[:\s]*(\d+)/i);
      const kilometers = kmMatch ? kmMatch[1] : undefined;
      const fuelMatch = text.match(/combustible[:\s]*([A-Za-z]+)/i) || text.match(/\b(diesel|gasolina|acpm|premium|corriente|bioacem)\b/i);
      const fuelType = fuelMatch ? fuelMatch[1].toUpperCase() : undefined;

      console.log('📊 OCR:', { gallons, cost, pricePerGallon, date, vehiclePlate, gasStationName });

      return {
        text,
        gallons,
        cost,
        pricePerGallon,
        date,
        vehiclePlate,
        kilometers,
        fuelType,
        gasStationName: gasStationName || undefined,
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
