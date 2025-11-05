import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../atoms/Input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar = React.memo<SearchBarProps>(
  ({ value, onChange, placeholder = 'Search...', className = '' }) => {
    return (
      <div className={className}>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          icon={<Search className="h-5 w-5 text-gray-400" />}
        />
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
