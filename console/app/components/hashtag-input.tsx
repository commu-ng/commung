import { Hash, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { api } from "~/lib/api-client";

interface HashtagInputProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
}

interface HashtagSuggestion {
  id: string;
  tag: string;
}

export function HashtagInput({
  value = [],
  onChange,
  label = "해시태그",
  placeholder = "해시태그를 입력하세요",
  disabled = false,
  maxTags = 10,
}: HashtagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch hashtag suggestions from API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.console.hashtags.search.$get({
        query: { q: query },
      });
      if (response.ok) {
        const result = await response.json();
        setSuggestions(result.data);
        setSelectedSuggestionIndex(0);
        setShowSuggestions(result.data.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Failed to fetch hashtag suggestions:", error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce API calls
  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, fetchSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSuggestions && event.target instanceof HTMLElement) {
        if (
          !event.target.closest(".hashtag-suggestions") &&
          !event.target.closest("input")
        ) {
          setShowSuggestions(false);
          setSuggestions([]);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSuggestions]);

  const addHashtag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();

    if (!cleanTag) return;
    if (value.includes(cleanTag)) return;
    if (value.length >= maxTags) return;

    // Validate tag format: only lowercase letters, numbers, and complete Korean characters
    // Reject tags with incomplete Korean characters (jamo)
    const validTagRegex = /^[a-z0-9가-힣]+$/;
    if (!validTagRegex.test(cleanTag)) {
      return;
    }

    onChange([...value, cleanTag]);
    setInputValue("");
    setShowSuggestions(false);
    setSuggestions([]);

    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const removeHashtag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case "Enter":
        case "Tab": {
          e.preventDefault();
          const selectedSuggestion = suggestions[selectedSuggestionIndex];
          if (selectedSuggestion) {
            addHashtag(selectedSuggestion.tag);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          setSuggestions([]);
          break;
      }
      return;
    }

    if (e.key === "Enter" && inputValue.trim() && !isComposing) {
      e.preventDefault();
      addHashtag(inputValue);
    }

    if (e.key === "Backspace" && !inputValue && value.length > 0) {
      e.preventDefault();
      const lastHashtag = value[value.length - 1];
      if (lastHashtag) {
        removeHashtag(lastHashtag);
      }
    }
  };

  const selectSuggestion = (suggestion: HashtagSuggestion) => {
    addHashtag(suggestion.tag);
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {/* Selected hashtags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              <Hash className="h-3 w-3" />
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeHashtag(tag)}
                  className="ml-1 hover:bg-accent rounded-full p-0.5 transition-colors"
                  title="해시태그 제거"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Input container with suggestions */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={
            value.length >= maxTags
              ? `최대 ${maxTags}개까지 가능합니다`
              : placeholder
          }
          disabled={disabled || value.length >= maxTags}
          className={
            showSuggestions && suggestions.length > 0 ? "rounded-b-none" : ""
          }
        />

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && !disabled && (
          <div className="hashtag-suggestions absolute z-10 w-full bg-popover border border-t-0 border-border rounded-b-2xl shadow-marsh-lg max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                type="button"
                key={suggestion.id}
                className={`px-3 py-2 cursor-pointer w-full text-left flex items-center gap-2 transition-colors ${
                  index === selectedSuggestionIndex
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-accent"
                }`}
                onClick={() => selectSuggestion(suggestion)}
              >
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{suggestion.tag}</span>
                {index === selectedSuggestionIndex && (
                  <div className="text-xs text-primary font-medium">Tab</div>
                )}
              </button>
            ))}

            {/* Help text */}
            <div className="px-3 py-2 bg-muted border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>↑↓ 선택</span>
                <span>Tab/Enter 확인</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Spinner />
          </div>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Enter 키로 해시태그를 추가하세요. 최대 {maxTags}개까지 가능합니다.
      </p>
    </div>
  );
}
