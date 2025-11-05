import { useState } from 'react';
import Tesseract from 'tesseract.js';

interface OCRResult {
  text: string;
  gallons: string;
  cost: string;
  date: string;
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

      // Patrones para extraer datos
      const gallonsPatterns = [
        /(\d+[.,]\d+)\s*gal/i,
        /galones?[:\s]*(\d+[.,]\d+)/i,
        /gal[:\s]*(\d+[.,]\d+)/i,
      ];

      const costPatterns = [
        /total[:\s]*\$?\s*(\d+[.,]\d+)/i,
        /\$\s*(\d+[.,]\d+)/,
        /(\d+[.,]\d+)\s*cop/i,
        /(\d{3,}[.,]?\d*)/,
      ];

      const datePatterns = [
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
        /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
        /(\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+\d{2,4})/i,
      ];

      // Extraer galones
      let gallons = '';
      for (const pattern of gallonsPatterns) {
        const match = text.match(pattern);
        if (match) {
          gallons = match[1].replace(',', '.');
          break;
        }
      }

      // Extraer costo
      let cost = '';
      for (const pattern of costPatterns) {
        const match = text.match(pattern);
        if (match) {
          cost = match[1].replace(',', '');
          if (parseFloat(cost) > 1000) { // Filtrar valores muy pequeños
            break;
          }
        }
      }

      // Extraer fecha
      let date = '';
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          date = match[1];
          break;
        }
      }

      return {
        text,
        gallons,
        cost,
        date,
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

