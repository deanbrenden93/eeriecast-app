import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onClose();
      navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg w-full max-w-2xl mx-4">
        <form onSubmit={handleSearch} className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search for podcasts, episodes, or creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10 py-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-lg focus:border-blue-500 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Press Enter to search or Escape to close
          </div>
        </form>
      </div>
    </div>
  );
}