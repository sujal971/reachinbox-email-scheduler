import React, { useState, useEffect } from 'react';
import { Search, X, Database } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  searchSource?: string;
  totalResults?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isSearching,
  searchSource,
  totalResults,
}) => {
  const [term, setTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(term);
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  const handleClear = () => {
    setTerm('');
    onSearch('');
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 my-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by recipient, sender, subject, or content (Elasticsearch)..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="w-full bg-dark-850 border border-dark-700 rounded-lg pl-10 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition shadow-sm"
        />
        {term && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Index Engine Badge */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 bg-dark-850 border border-dark-700 px-2.5 py-1.5 rounded-md">
          <Database className="w-3 h-3 text-cyan-400" />
          <span className="font-medium text-slate-300">
            {searchSource === 'elasticsearch' ? 'Elasticsearch 8.11' : 'Elasticsearch Index Active'}
          </span>
        </div>
        {term && totalResults !== undefined && (
          <span className="text-slate-400 font-medium">
            {totalResults} result{totalResults === 1 ? '' : 's'}
          </span>
        )}
        {isSearching && (
          <div className="w-3 h-3 border-2 border-brand-accent/40 border-t-brand-accent rounded-full animate-spin"></div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
