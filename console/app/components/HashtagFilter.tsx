import { Filter, Hash, X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface HashtagFilterProps {
  allHashtags: string[];
  selectedHashtags: string[];
  onToggleHashtag: (hashtag: string) => void;
  onClearFilters: () => void;
}

export function HashtagFilter({
  allHashtags,
  selectedHashtags,
  onToggleHashtag,
  onClearFilters,
}: HashtagFilterProps) {
  return (
    <div className="mb-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-lg">해시태그로 필터링</CardTitle>
            </div>
            {selectedHashtags.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                필터 초기화
              </Button>
            )}
          </div>
          <CardDescription>
            {allHashtags.length > 0
              ? "관심 있는 해시태그를 선택해서 게시물을 필터링하세요"
              : "이 게시판에는 아직 해시태그가 없습니다"}
          </CardDescription>
        </CardHeader>
        {allHashtags.length > 0 && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allHashtags.map((hashtag) => (
                <Badge
                  key={hashtag}
                  variant={
                    selectedHashtags.includes(hashtag) ? "default" : "outline"
                  }
                  className={`cursor-pointer transition-colors ${
                    selectedHashtags.includes(hashtag)
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "hover:bg-primary/15 hover:border-primary/30"
                  }`}
                  onClick={() => onToggleHashtag(hashtag)}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {hashtag}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
