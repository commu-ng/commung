import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "~/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { api } from "~/lib/api-client";

const TIME_RANGES = [
  { value: 7, label: "7일" },
  { value: 14, label: "14일" },
  { value: 30, label: "30일" },
  { value: 90, label: "90일" },
] as const;

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type ActivityData = {
  timeline: {
    posts: Array<{ date: string; count: number }>;
    directMessages: Array<{ date: string; count: number }>;
    groupMessages: Array<{ date: string; count: number }>;
  };
  hourlyTimeline: {
    posts: Array<{ datetime: string; count: number }>;
    directMessages: Array<{ datetime: string; count: number }>;
    groupMessages: Array<{ datetime: string; count: number }>;
  };
  heatmap: {
    posts: Array<{ hour: number; dayOfWeek: number; count: number }>;
    directMessages: Array<{ hour: number; dayOfWeek: number; count: number }>;
    groupMessages: Array<{ hour: number; dayOfWeek: number; count: number }>;
  };
  totals: {
    posts: number;
    directMessages: number;
    groupMessages: number;
  };
  mostActiveProfiles: Array<{
    profile_id: string;
    profile_name: string;
    profile_username: string;
    avatar_url: string | null;
    posts_count: number;
    dms_count: number;
    group_messages_count: number;
    total_activity: number;
  }>;
  leastActiveProfiles: Array<{
    profile_id: string;
    profile_name: string;
    profile_username: string;
    avatar_url: string | null;
    posts_count: number;
    dms_count: number;
    group_messages_count: number;
    total_activity: number;
  }>;
};

export default function CommunityAnalytics() {
  const { slug } = useParams();
  const [days, setDays] = useState(30);
  const [timelineView, setTimelineView] = useState<"daily" | "hourly">("daily");
  const chartScrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["community-activity", slug, days],
    queryFn: async () => {
      const response = await api.console.communities[":id"].activity.$get({
        param: { id: slug ?? "" },
        query: { days: days.toString() },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch activity data");
      }
      const result = await response.json();
      return result.data as ActivityData;
    },
    enabled: !!slug,
  });

  // Generate complete date range for timeline based on selected time period
  const timelineData = (() => {
    if (!data) return [];

    // Generate date range for the full selected period (days parameter)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1); // Include today

    // Generate all dates in range
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    // Create data for each date
    return dateRange.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const post = data.timeline.posts.find((p) => p.date === dateStr);
      const dm = data.timeline.directMessages.find((d) => d.date === dateStr);
      const gm = data.timeline.groupMessages.find((g) => g.date === dateStr);

      return {
        date: dateStr,
        posts: post?.count || 0,
        directMessages: dm?.count || 0,
        groupMessages: gm?.count || 0,
      };
    });
  })();

  // Generate complete hourly range for hourly timeline based on selected time period
  const hourlyTimelineData = (() => {
    if (!data) return [];

    // Create a map of normalized datetime strings to data for efficient lookup
    const postsMap = new Map(
      data.hourlyTimeline.posts.map((p) => {
        const normalized = parseISO(p.datetime);
        const key = `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}T${String(normalized.getHours()).padStart(2, "0")}`;
        return [key, p.count];
      }),
    );
    const dmsMap = new Map(
      data.hourlyTimeline.directMessages.map((d) => {
        const normalized = parseISO(d.datetime);
        const key = `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}T${String(normalized.getHours()).padStart(2, "0")}`;
        return [key, d.count];
      }),
    );
    const gmsMap = new Map(
      data.hourlyTimeline.groupMessages.map((g) => {
        const normalized = parseISO(g.datetime);
        const key = `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}T${String(normalized.getHours()).padStart(2, "0")}`;
        return [key, g.count];
      }),
    );

    // Generate hourly range for the full selected period (days parameter)
    const endDatetime = new Date();
    endDatetime.setMinutes(0, 0, 0); // Round to current hour

    const startDatetime = new Date();
    startDatetime.setDate(startDatetime.getDate() - days + 1);
    startDatetime.setHours(0, 0, 0, 0); // Start at midnight

    // Generate all hours in range
    const hourlyRange: Date[] = [];
    for (
      let dt = new Date(startDatetime);
      dt <= endDatetime;
      dt = new Date(dt.getTime() + 60 * 60 * 1000)
    ) {
      hourlyRange.push(new Date(dt));
    }

    // Create data for each hour
    return hourlyRange.map((datetime) => {
      const key = `${datetime.getFullYear()}-${String(datetime.getMonth() + 1).padStart(2, "0")}-${String(datetime.getDate()).padStart(2, "0")}T${String(datetime.getHours()).padStart(2, "0")}`;

      return {
        datetime: datetime.toISOString(),
        hour: format(datetime, "M/d H시", { locale: ko }),
        posts: postsMap.get(key) || 0,
        directMessages: dmsMap.get(key) || 0,
        groupMessages: gmsMap.get(key) || 0,
      };
    });
  })();

  // Prepare heatmap data
  const postsHeatmapData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const entry = data?.heatmap.posts.find(
        (item) => item.dayOfWeek === day && item.hour === hour,
      );
      return entry?.count || 0;
    }),
  );

  const dmsHeatmapData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const entry = data?.heatmap.directMessages.find(
        (item) => item.dayOfWeek === day && item.hour === hour,
      );
      return entry?.count || 0;
    }),
  );

  const groupMessagesHeatmapData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const entry = data?.heatmap.groupMessages.find(
        (item) => item.dayOfWeek === day && item.hour === hour,
      );
      return entry?.count || 0;
    }),
  );

  // Calculate max values for color scaling
  const maxPostsHeatmap = Math.max(...postsHeatmapData.flat(), 1);
  const maxDmsHeatmap = Math.max(...dmsHeatmapData.flat(), 1);
  const maxGroupMessagesHeatmap = Math.max(
    ...groupMessagesHeatmapData.flat(),
    1,
  );

  // Color scale function - returns RGB colors with varying opacity
  const getHeatmapColor = (
    value: number,
    max: number,
    type: "posts" | "dms" | "groupMessages",
  ) => {
    if (value === 0)
      return "color-mix(in oklch, var(--muted-foreground) 10%, transparent)";
    const intensity = value / max;
    const opacity = 0.3 + intensity * 0.7;
    const colorVar =
      type === "posts"
        ? "var(--chart-5)"
        : type === "dms"
          ? "var(--chart-3)"
          : "var(--chart-2)";
    return `color-mix(in oklch, ${colorVar} ${Math.round(opacity * 100)}%, transparent)`;
  };

  // Scroll to the end of the timeline chart to show latest data
  // biome-ignore lint/correctness/useExhaustiveDependencies: timelineView is intentionally included to scroll when switching views
  useEffect(() => {
    if (chartScrollRef.current && data) {
      // Use setTimeout to ensure the DOM has been updated after data changes
      setTimeout(() => {
        if (chartScrollRef.current) {
          chartScrollRef.current.scrollLeft =
            chartScrollRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [data, timelineView]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="w-full py-8 px-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">활동 분석</h1>
          <p className="text-muted-foreground mt-2">
            커뮤니티의 게시글 및 DM 활동 통계
          </p>
        </div>
        <div className="flex gap-2">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={days === range.value ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">총 게시글</div>
          <div className="mt-2 text-3xl font-bold">{data?.totals.posts}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">총 DM</div>
          <div className="mt-2 text-3xl font-bold">
            {data?.totals.directMessages}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">총 그룹 DM</div>
          <div className="mt-2 text-3xl font-bold">
            {data?.totals.groupMessages}
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">활동 타임라인</h2>
          <div className="flex gap-2">
            <Button
              variant={timelineView === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimelineView("daily")}
            >
              일별
            </Button>
            <Button
              variant={timelineView === "hourly" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimelineView("hourly")}
            >
              시간별
            </Button>
          </div>
        </div>
        <div className="relative overflow-hidden">
          <div
            ref={chartScrollRef}
            className="w-full overflow-x-auto overflow-y-hidden"
          >
            <ChartContainer
              config={{
                posts: {
                  label: "게시글",
                  color: "var(--chart-5)",
                },
                directMessages: {
                  label: "DM",
                  color: "var(--chart-3)",
                },
                groupMessages: {
                  label: "그룹 DM",
                  color: "var(--chart-2)",
                },
              }}
              className="h-[400px]"
              style={{
                width:
                  timelineView === "daily"
                    ? `${Math.max(600, timelineData.length * 40)}px`
                    : `${Math.max(600, hourlyTimelineData.length * 20)}px`,
              }}
            >
              <BarChart
                data={
                  timelineView === "daily" ? timelineData : hourlyTimelineData
                }
                barSize={timelineView === "daily" ? 32 : 16}
                margin={{ left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={timelineView === "daily" ? "date" : "hour"}
                  tickFormatter={
                    timelineView === "daily"
                      ? (value) =>
                          format(parseISO(value), "M/d", { locale: ko })
                      : undefined
                  }
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval="preserveStartEnd"
                />
                <YAxis />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={
                        timelineView === "daily"
                          ? (value) =>
                              format(
                                parseISO(value as string),
                                "yyyy년 M월 d일",
                                {
                                  locale: ko,
                                },
                              )
                          : undefined
                      }
                    />
                  }
                />
                <Bar
                  dataKey="posts"
                  stackId="1"
                  fill="var(--chart-5)"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="directMessages"
                  stackId="1"
                  fill="var(--chart-3)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="groupMessages"
                  stackId="1"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
          {/* Sticky Y-axis mask - keeps Y-axis visible during horizontal scroll */}
          <div
            className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-card via-card to-transparent pointer-events-none"
            style={{ zIndex: 10 }}
          />
        </div>
        {/* Centered Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--chart-5)" }}
            />
            <span className="text-sm">게시글</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--chart-3)" }}
            />
            <span className="text-sm">DM</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--chart-2)" }}
            />
            <span className="text-sm">그룹 DM</span>
          </div>
        </div>
      </div>

      {/* Heatmaps Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Posts Heatmap */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">게시글 활동 히트맵</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-12">
                  <div className="h-6 mb-2" /> {/* Spacer for hour labels */}
                  <div className="space-y-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day}
                        className="h-8 flex items-center justify-end pr-2 text-sm text-muted-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex gap-1 mb-2 h-6">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="w-8 text-xs text-muted-foreground text-center"
                      >
                        {hour % 3 === 0 ? hour : ""}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {postsHeatmapData.map((dayData, dayIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: heatmap indices are stable (days 0-6, hours 0-23)
                      <div key={`posts-day-${dayIndex}`} className="flex gap-1">
                        {dayData.map((count, hourIndex) => {
                          const key = `posts-${dayIndex}-${hourIndex}`;
                          return (
                            <div
                              key={key}
                              className="w-8 h-8 rounded-sm border border-border/50 flex items-center justify-center text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  count,
                                  maxPostsHeatmap,
                                  "posts",
                                ),
                              }}
                              title={`${DAYS_OF_WEEK[dayIndex]} ${hourIndex}시: ${count}개`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DMs Heatmap */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">DM 활동 히트맵</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-12">
                  <div className="h-6 mb-2" /> {/* Spacer for hour labels */}
                  <div className="space-y-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day}
                        className="h-8 flex items-center justify-end pr-2 text-sm text-muted-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex gap-1 mb-2 h-6">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="w-8 text-xs text-muted-foreground text-center"
                      >
                        {hour % 3 === 0 ? hour : ""}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {dmsHeatmapData.map((dayData, dayIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: heatmap indices are stable (days 0-6, hours 0-23)
                      <div key={`dms-day-${dayIndex}`} className="flex gap-1">
                        {dayData.map((count, hourIndex) => {
                          const key = `dms-${dayIndex}-${hourIndex}`;
                          return (
                            <div
                              key={key}
                              className="w-8 h-8 rounded-sm border border-border/50 flex items-center justify-center text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  count,
                                  maxDmsHeatmap,
                                  "dms",
                                ),
                              }}
                              title={`${DAYS_OF_WEEK[dayIndex]} ${hourIndex}시: ${count}개`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Group Messages Heatmap */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">그룹 DM 활동 히트맵</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-12">
                  <div className="h-6 mb-2" /> {/* Spacer for hour labels */}
                  <div className="space-y-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day}
                        className="h-8 flex items-center justify-end pr-2 text-sm text-muted-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex gap-1 mb-2 h-6">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="w-8 text-xs text-muted-foreground text-center"
                      >
                        {hour % 3 === 0 ? hour : ""}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {groupMessagesHeatmapData.map((dayData, dayIndex) => (
                      <div
                        key={`group-messages-day-${
                          // biome-ignore lint/suspicious/noArrayIndexKey: heatmap indices are stable (days 0-6, hours 0-23)
                          dayIndex
                        }`}
                        className="flex gap-1"
                      >
                        {dayData.map((count, hourIndex) => {
                          const key = `group-messages-${dayIndex}-${hourIndex}`;
                          return (
                            <div
                              key={key}
                              className="w-8 h-8 rounded-sm border border-border/50 flex items-center justify-center text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  count,
                                  maxGroupMessagesHeatmap,
                                  "groupMessages",
                                ),
                              }}
                              title={`${DAYS_OF_WEEK[dayIndex]} ${hourIndex}시: ${count}개`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Most and Least Active Profiles */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Most Active Profiles */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">가장 활발한 프로필</h2>
          {data?.mostActiveProfiles && data.mostActiveProfiles.length > 0 ? (
            <div className="space-y-3">
              {data.mostActiveProfiles.map((profile, index) => (
                <div
                  key={profile.profile_id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0 w-8 text-center text-sm font-semibold text-muted-foreground">
                    #{index + 1}
                  </div>
                  <div className="flex-shrink-0">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.profile_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                        {profile.profile_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {profile.profile_name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      @{profile.profile_username}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-semibold">
                      {profile.total_activity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      게시글 {profile.posts_count} · DM {profile.dms_count} ·{" "}
                      그룹 {profile.group_messages_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              활동 데이터가 없습니다
            </p>
          )}
        </div>

        {/* Least Active Profiles */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">가장 조용한 프로필</h2>
          {data?.leastActiveProfiles && data.leastActiveProfiles.length > 0 ? (
            <div className="space-y-3">
              {data.leastActiveProfiles.map((profile, index) => (
                <div
                  key={profile.profile_id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0 w-8 text-center text-sm font-semibold text-muted-foreground">
                    #{index + 1}
                  </div>
                  <div className="flex-shrink-0">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.profile_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                        {profile.profile_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {profile.profile_name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      @{profile.profile_username}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-semibold">
                      {profile.total_activity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      게시글 {profile.posts_count} · DM {profile.dms_count} ·{" "}
                      그룹 {profile.group_messages_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              활동 데이터가 없습니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
