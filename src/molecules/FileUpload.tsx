import React, { useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '../atoms/Button';

interface FileUploadProps {
  label?: string;
  accept?: string;
  value?: string;
  onChange: (file: File | null) => void;
  error?: string;
  preview?: boolean;
}

export const FileUpload = React.memo<FileUploadProps>(
  ({ label, accept = 'image/*', value, onChange, error, preview = true }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onChange(file);
      }
    };

    const handleClear = () => {
      onChange(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>

            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {preview && value && (
            <div className="relative w-full h-48 border border-gray-300 rounded-lg overflow-hidden">
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload';
