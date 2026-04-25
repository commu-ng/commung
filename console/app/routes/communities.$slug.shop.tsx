import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Coins,
  Edit2,
  Gift,
  Package,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "~/components/shared/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/communities.$slug.shop";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "상점 관리" },
    { name: "description", content: "상점의 통화와 상품을 관리합니다" },
  ];
}

interface Currency {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
interface Item {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currencyId: string;
  currencyName: string;
  consumable: boolean;
  isUnique: boolean;
}
interface Transaction {
  id: string;
  profileId: string;
  profileName: string | null;
  profileUsername: string | null;
  kind: string;
  source: string;
  currencyId: string | null;
  currencyDelta: number | null;
  itemId: string | null;
  itemQtyDelta: number | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
}

async function fetchCurrencies(slug: string): Promise<Currency[]> {
  const r = await api.console.communities[":id"].shop.currencies.$get({
    param: { id: slug },
  });
  if (!r.ok) throw new Error("통화 목록을 가져오지 못했습니다");
  return (await r.json()).data as Currency[];
}
async function fetchItems(slug: string): Promise<Item[]> {
  const r = await api.console.communities[":id"].shop.items.$get({
    param: { id: slug },
  });
  if (!r.ok) throw new Error("상품 목록을 가져오지 못했습니다");
  return (await r.json()).data as Item[];
}
async function fetchTransactions(slug: string): Promise<Transaction[]> {
  const r = await api.console.communities[":id"].shop.transactions.$get({
    param: { id: slug },
    query: {},
  });
  if (!r.ok) throw new Error("거래 내역을 가져오지 못했습니다");
  return (await r.json()).data as unknown as Transaction[];
}

function CurrencyDialog({
  slug,
  currency,
  onClose,
}: {
  slug: string;
  currency?: Currency;
  onClose: () => void;
}) {
  const [name, setName] = useState(currency?.name ?? "");
  const [description, setDescription] = useState(currency?.description ?? "");
  const [isDefault, setIsDefault] = useState(currency?.isDefault ?? false);
  const queryClient = useQueryClient();
  const nameId = useId();
  const descriptionId = useId();
  const defaultId = useId();

  const mutation = useMutation({
    mutationFn: async () => {
      const json = {
        name,
        description: description || null,
        is_default: isDefault,
      };
      const response = currency
        ? await api.console.communities[":id"].shop.currencies[
            ":currencyId"
          ].$patch({
            param: { id: slug, currencyId: currency.id },
            json,
          })
        : await api.console.communities[":id"].shop.currencies.$post({
            param: { id: slug },
            json,
          });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "저장에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success(
        currency ? "통화가 수정되었습니다" : "통화가 추가되었습니다",
      );
      queryClient.invalidateQueries({ queryKey: ["shop-currencies", slug] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{currency ? "통화 수정" : "새 통화"}</DialogTitle>
        <DialogDescription>
          커뮤에서 사용할 통화를 정의합니다. 예: 골드, 별점, 조개
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor={nameId}>이름</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="골드"
            maxLength={50}
          />
        </div>
        <div>
          <Label htmlFor={descriptionId}>설명 (선택)</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id={defaultId}
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <Label htmlFor={defaultId}>기본 통화로 설정</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ItemDialog({
  slug,
  currencies,
  item,
  onClose,
}: {
  slug: string;
  currencies: Currency[];
  item?: Item;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceAmount, setPriceAmount] = useState(
    item?.priceAmount.toString() ?? "",
  );
  const [currencyId, setCurrencyId] = useState(
    item?.currencyId ?? currencies.find((c) => c.isDefault)?.id ?? "",
  );
  const [consumable, setConsumable] = useState(item?.consumable ?? false);
  const [isUnique, setIsUnique] = useState(item?.isUnique ?? false);
  const queryClient = useQueryClient();
  const nameId = useId();
  const descriptionId = useId();
  const priceId = useId();
  const consumableId = useId();
  const uniqueId = useId();

  const mutation = useMutation({
    mutationFn: async () => {
      const price = Number.parseInt(priceAmount, 10);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("가격은 1 이상의 정수여야 합니다");
      }
      if (!currencyId) {
        throw new Error("통화를 선택하세요");
      }
      const json = {
        name,
        description: description || null,
        price_amount: price,
        currency_id: currencyId,
        consumable,
        is_unique: isUnique,
      };
      const response = item
        ? await api.console.communities[":id"].shop.items[":itemId"].$patch({
            param: { id: slug, itemId: item.id },
            json,
          })
        : await api.console.communities[":id"].shop.items.$post({
            param: { id: slug },
            json,
          });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "저장에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success(item ? "상품이 수정되었습니다" : "상품이 추가되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-items", slug] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{item ? "상품 수정" : "새 상품"}</DialogTitle>
        <DialogDescription>
          상점에서 판매할 상품을 등록합니다.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor={nameId}>이름</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="검"
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor={descriptionId}>설명 (선택)</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={priceId}>가격</Label>
            <Input
              id={priceId}
              type="number"
              min={1}
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>통화</Label>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger>
                <SelectValue placeholder="통화 선택" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.isDefault ? " (기본)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={consumableId}
            type="checkbox"
            checked={consumable}
            onChange={(e) => setConsumable(e.target.checked)}
          />
          <Label htmlFor={consumableId}>소모품 (사용 시 차감)</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={uniqueId}
            type="checkbox"
            checked={isUnique}
            onChange={(e) => setIsUnique(e.target.checked)}
          />
          <Label htmlFor={uniqueId}>한 명당 하나만 구매 가능</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          disabled={
            !name.trim() || !priceAmount || !currencyId || mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface ProfileSearchResult {
  id: string;
  name: string;
  username: string;
}

function GrantDialog({
  slug,
  currencies,
  items,
  onClose,
}: {
  slug: string;
  currencies: Currency[];
  items: Item[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"currency" | "item">("currency");
  const [profileId, setProfileId] = useState("");
  const [profileQuery, setProfileQuery] = useState("");
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>(
    [],
  );
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<ProfileSearchResult | null>(null);
  const [currencyId, setCurrencyId] = useState(
    currencies.find((c) => c.isDefault)?.id ?? currencies[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const profileInputId = useId();
  const amountId = useId();
  const qtyId = useId();
  const reasonId = useId();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("프로필 ID를 입력하세요");
      const json =
        kind === "currency"
          ? {
              kind: "currency" as const,
              profile_id: profileId,
              currency_id: currencyId,
              amount: Number.parseInt(amount, 10),
              reason: reason || null,
            }
          : {
              kind: "item" as const,
              profile_id: profileId,
              item_id: itemId,
              qty: Number.parseInt(qty, 10) || 1,
              reason: reason || null,
            };
      const response = await api.console.communities[":id"].shop.grants.$post({
        param: { id: slug },
        json,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "지급에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("지급되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-transactions", slug] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>지급</DialogTitle>
        <DialogDescription>
          특정 프로필에게 통화나 상품을 직접 지급합니다.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={kind === "currency" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("currency")}
          >
            통화
          </Button>
          <Button
            type="button"
            variant={kind === "item" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("item")}
          >
            상품
          </Button>
        </div>
        <div className="relative">
          <Label htmlFor={profileInputId}>받는 프로필</Label>
          {selectedProfile ? (
            <div className="flex items-center justify-between gap-2 mt-1 px-3 py-2 rounded-md border bg-muted">
              <span className="text-sm">
                <span className="font-medium">{selectedProfile.name}</span>{" "}
                <span className="text-muted-foreground">
                  @{selectedProfile.username}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedProfile(null);
                  setProfileId("");
                  setProfileQuery("");
                  setShowProfileDropdown(true);
                }}
              >
                변경
              </Button>
            </div>
          ) : (
            <>
              <Input
                id={profileInputId}
                value={profileQuery}
                onChange={async (e) => {
                  const q = e.target.value;
                  setProfileQuery(q);
                  setShowProfileDropdown(true);
                  try {
                    const r = await api.console.communities[
                      ":id"
                    ].shop.profiles.$get({
                      param: { id: slug },
                      query: { q },
                    });
                    if (r.ok) {
                      const result = await r.json();
                      setProfileResults(
                        (result.data as ProfileSearchResult[]) ?? [],
                      );
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                onFocus={() => setShowProfileDropdown(true)}
                placeholder="이름 또는 사용자명으로 검색"
              />
              {showProfileDropdown && profileResults.length > 0 && (
                <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-card shadow-md">
                  {profileResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => {
                        setSelectedProfile(p);
                        setProfileId(p.id);
                        setShowProfileDropdown(false);
                      }}
                    >
                      <span className="font-medium">{p.name}</span>{" "}
                      <span className="text-muted-foreground">
                        @{p.username}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {kind === "currency" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>통화</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger>
                  <SelectValue placeholder="통화 선택" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={amountId}>금액</Label>
              <Input
                id={amountId}
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>상품</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="상품 선택" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={qtyId}>수량</Label>
              <Input
                id={qtyId}
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <Label htmlFor={reasonId}>사유 (선택)</Label>
          <Input
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="이벤트 보상"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          disabled={
            !profileId ||
            (kind === "currency" ? !amount : !itemId || !qty) ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "지급 중..." : "지급"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CurrencyCard({
  slug,
  currency,
}: {
  slug: string;
  currency: Currency;
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await api.console.communities[":id"].shop.currencies[
        ":currencyId"
      ].$delete({
        param: { id: slug, currencyId: currency.id },
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "삭제에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("통화가 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-currencies", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currency.name}</span>
            {currency.isDefault && (
              <Badge variant="secondary">
                <Star className="h-3 w-3 mr-1" />
                기본
              </Badge>
            )}
          </div>
          {currency.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {currency.description}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            {editing && (
              <CurrencyDialog
                slug={slug}
                currency={currency}
                onClose={() => setEditing(false)}
              />
            )}
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (
                window.confirm(`"${currency.name}" 통화를 삭제하시겠습니까?`)
              ) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemCard({
  slug,
  item,
  currencies,
}: {
  slug: string;
  item: Item;
  currencies: Currency[];
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await api.console.communities[":id"].shop.items[
        ":itemId"
      ].$delete({
        param: { id: slug, itemId: item.id },
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(getErrorMessage(data, "삭제에 실패했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("상품이 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-items", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{item.name}</span>
              <Badge variant="secondary">
                {item.priceAmount} {item.currencyName}
              </Badge>
              {item.consumable && <Badge variant="outline">소모품</Badge>}
              {item.isUnique && <Badge variant="outline">유니크</Badge>}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Dialog open={editing} onOpenChange={setEditing}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              {editing && (
                <ItemDialog
                  slug={slug}
                  currencies={currencies}
                  item={item}
                  onClose={() => setEditing(false)}
                />
              )}
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`"${item.name}" 상품을 삭제하시겠습니까?`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const kindLabel: Record<string, string> = {
    currency_grant: "통화 지급",
    currency_charge: "통화 차감",
    currency_refund: "통화 환불",
    item_grant: "상품 지급",
    item_purchase: "상품 구매",
    item_consume: "상품 소비",
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{kindLabel[txn.kind] ?? txn.kind}</span>
          <Badge variant="outline" className="font-mono text-xs">
            {txn.source}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {txn.profileName ? (
            <>
              <span className="font-medium">{txn.profileName}</span>{" "}
              <span className="font-mono">@{txn.profileUsername}</span>
            </>
          ) : (
            <span className="font-mono">
              profile {txn.profileId.slice(0, 8)}…
            </span>
          )}
          {txn.currencyDelta !== null && ` · ${txn.currencyDelta}`}
          {txn.itemQtyDelta !== null && ` · ${txn.itemQtyDelta}개`}
        </div>
        {txn.reason && (
          <div className="text-xs text-muted-foreground italic">
            {txn.reason}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(txn.createdAt).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const slugStr = slug ?? "";

  const [creatingCurrency, setCreatingCurrency] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [granting, setGranting] = useState(false);

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery({
    queryKey: ["shop-currencies", slug],
    queryFn: () => fetchCurrencies(slugStr),
    enabled: !!slug,
  });
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["shop-items", slug],
    queryFn: () => fetchItems(slugStr),
    enabled: !!slug,
  });
  const { data: transactions = [], isLoading: txnsLoading } = useQuery({
    queryKey: ["shop-transactions", slug],
    queryFn: () => fetchTransactions(slugStr),
    enabled: !!slug,
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to={`/communities/${slug}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
          <Dialog open={granting} onOpenChange={setGranting}>
            <DialogTrigger asChild>
              <Button disabled={currencies.length === 0 && items.length === 0}>
                <Gift className="w-4 h-4 mr-2" />
                지급
              </Button>
            </DialogTrigger>
            {granting && (
              <GrantDialog
                slug={slugStr}
                currencies={currencies}
                items={items}
                onClose={() => setGranting(false)}
              />
            )}
          </Dialog>
        </div>

        <PageHeader
          eyebrow="운영"
          icon={Coins}
          title="상점"
          description="통화와 상품을 정의하고 멤버에게 지급하세요"
          tone="butter"
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">통화</h2>
            <Dialog open={creatingCurrency} onOpenChange={setCreatingCurrency}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />새 통화
                </Button>
              </DialogTrigger>
              {creatingCurrency && (
                <CurrencyDialog
                  slug={slugStr}
                  onClose={() => setCreatingCurrency(false)}
                />
              )}
            </Dialog>
          </div>
          {currenciesLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : currencies.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                정의된 통화가 없습니다. 통화를 추가해 상점을 시작하세요.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {currencies.map((c) => (
                <CurrencyCard key={c.id} slug={slugStr} currency={c} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">상품</h2>
            <Dialog open={creatingItem} onOpenChange={setCreatingItem}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currencies.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" />새 상품
                </Button>
              </DialogTrigger>
              {creatingItem && (
                <ItemDialog
                  slug={slugStr}
                  currencies={currencies}
                  onClose={() => setCreatingItem(false)}
                />
              )}
            </Dialog>
          </div>
          {itemsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {currencies.length === 0
                  ? "통화를 먼저 추가하세요."
                  : "상품이 없습니다. 상품을 추가하면 멤버가 구매할 수 있습니다."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((i) => (
                <ItemCard
                  key={i.id}
                  slug={slugStr}
                  item={i}
                  currencies={currencies}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">거래 내역</h2>
          <Card>
            <CardContent className="p-4">
              {txnsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  거래 내역이 없습니다.
                </p>
              ) : (
                <div>
                  {transactions.map((t) => (
                    <TransactionRow key={t.id} txn={t} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
