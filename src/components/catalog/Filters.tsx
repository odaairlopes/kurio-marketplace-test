import { useEffect, useState } from "react";
import type { CatalogResponse, CollectionId, Network } from "@/api/contracts";
import { COLLECTIONS, NETWORKS } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox, Slider } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { cmp, parseDecimalInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { COLLECTION_LABEL, NETWORK_LABEL } from "@/lib/utils";

export interface FilterState {
  collections: CollectionId[];
  networks: Network[];
  minPrice?: string;
  maxPrice?: string;
}

interface FiltersProps {
  value: FilterState;
  facets: CatalogResponse["facets"] | undefined;
  onChange: (next: FilterState) => void;
  idPrefix?: string;
  /** "figma": lista de links do layout desktop; "sheet": controles completos (mobile). */
  variant?: "figma" | "sheet";
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

function PriceFilter({ value, facets, onChange, idPrefix }: FiltersProps) {
  const min = Number(facets?.priceRange.min ?? 0);
  const max = Math.max(Number(facets?.priceRange.max ?? 15), min + 0.01);
  const [draft, setDraft] = useState({
    min: value.minPrice ?? "",
    max: value.maxPrice ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({ min: value.minPrice ?? "", max: value.maxPrice ?? "" });
  }, [value.minPrice, value.maxPrice]);

  const sliderValue = [
    draft.min ? Number(draft.min) : min,
    draft.max ? Number(draft.max) : max,
  ];

  const apply = () => {
    const parsedMin = draft.min ? parseDecimalInput(draft.min) : undefined;
    const parsedMax = draft.max ? parseDecimalInput(draft.max) : undefined;
    if (parsedMin === null || parsedMax === null)
      return setError("Use valores numéricos, ex.: 0,5");
    if (parsedMin && parsedMax && cmp(parsedMin, parsedMax) > 0)
      return setError("O mínimo deve ser menor que o máximo.");
    setError(null);
    onChange({ ...value, minPrice: parsedMin, maxPrice: parsedMax });
  };

  const errorId = `${idPrefix}-price-error`;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-bold">Faixa de preço</legend>
      <Slider
        min={min}
        max={max}
        step={0.01}
        value={sliderValue}
        thumbLabels={["Preço mínimo", "Preço máximo"]}
        onValueChange={([a, b]) =>
          setDraft({ min: a.toFixed(2), max: b.toFixed(2) })
        }
      />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`${idPrefix}-min`}>
          Preço mínimo em ETH
        </label>
        <Input
          id={`${idPrefix}-min`}
          inputMode="decimal"
          placeholder={facets ? facets.priceRange.min : "mín."}
          value={draft.min}
          onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-9"
        />
        <span aria-hidden className="text-fg-muted">
          –
        </span>
        <label className="sr-only" htmlFor={`${idPrefix}-max`}>
          Preço máximo em ETH
        </label>
        <Input
          id={`${idPrefix}-max`}
          inputMode="decimal"
          placeholder={facets ? facets.priceRange.max : "máx."}
          value={draft.max}
          onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-9"
        />
        <span className="text-sm text-fg-muted">ETH</span>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
      <Button
        size="sm"
        className="self-start normal-case tracking-normal"
        onClick={apply}
      >
        Aplicar
      </Button>
    </fieldset>
  );
}

function formatRange(n: number) {
  return n.toFixed(2).replace(".", ",");
}

function FigmaPriceFilter({ value, facets, onChange, idPrefix }: FiltersProps) {
  const min = Number(facets?.priceRange.min ?? 0.02);
  const max = Math.max(Number(facets?.priceRange.max ?? 12.3), min + 0.01);
  // A escala do controle vai além do maior preço (folga de ~35%).
  const ceiling = Math.ceil(max * 1.35);
  const [range, setRange] = useState<[number, number]>([
    value.minPrice ? Number(value.minPrice) : min,
    value.maxPrice ? Number(value.maxPrice) : max,
  ]);
  useEffect(() => {
    setRange([
      value.minPrice ? Number(value.minPrice) : min,
      value.maxPrice ? Number(value.maxPrice) : max,
    ]);
  }, [value.minPrice, value.maxPrice, min, max]);

  const apply = () => {
    const [a, b] = range;
    onChange({
      ...value,
      minPrice: a > min + 0.004 ? a.toFixed(2) : undefined,
      maxPrice: b < max - 0.004 ? b.toFixed(2) : undefined,
    });
  };

  return (
    <fieldset id={`${idPrefix}-price`}>
      <legend className="mb-2 text-lg font-bold leading-6 text-fg-strong">
        Faixa de preço
      </legend>
      <div className="px-3">
        <Slider
          min={min}
          max={ceiling}
          step={0.01}
          value={range}
          thumbLabels={["Preço mínimo", "Preço máximo"]}
          onValueChange={([a, b]) => setRange([a, b])}
          className="py-1.5"
        />
        <p
          className="mt-3.5 text-sm leading-6 text-fg-muted"
          aria-live="polite"
        >
          Preço: {formatRange(range[0])} - {formatRange(range[1])} ETH
        </p>
        <Button
          size="sm"
          className="mt-3 h-9 px-3 text-base font-bold normal-case tracking-normal"
          onClick={apply}
        >
          Aplicar
        </Button>
      </div>
    </fieldset>
  );
}

function FigmaFilters(props: FiltersProps) {
  const { value, facets, onChange, idPrefix = "f" } = props;
  const count = (
    list: { id: string; count: number }[] | undefined,
    id: string,
  ) => list?.find((f) => f.id === id)?.count;
  const num = (n: number | undefined, bold: boolean) =>
    n === undefined ? (
      <Skeleton className="h-3.5 w-6" />
    ) : (
      <span className={bold ? "font-bold text-fg" : "text-fg-muted"}>
        <span className="sr-only">resultados: </span>({n})
      </span>
    );

  return (
    <div className="flex flex-col gap-9">
      <fieldset>
        <legend className="mb-2 text-lg font-bold leading-6 text-fg-strong">
          Coleções
        </legend>
        <ul className="flex flex-col">
          {COLLECTIONS.map((id) => {
            const checked = value.collections.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() =>
                    onChange({
                      ...value,
                      collections: toggle(value.collections, id),
                    })
                  }
                  className={cn(
                    "flex h-10 w-full items-center justify-between pl-3 pr-3 text-sm transition-colors hover:text-accent-text",
                    checked ? "font-bold text-accent-text" : "text-fg-muted",
                  )}
                >
                  <span>{COLLECTION_LABEL[id]}</span>
                  {num(count(facets?.collections, id), true)}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <FigmaPriceFilter {...props} idPrefix={idPrefix} />

      <fieldset>
        <legend className="mb-2 text-lg font-bold leading-6 text-fg-strong">
          Rede
        </legend>
        <ul className="flex flex-col">
          {NETWORKS.map((id) => {
            const checked = value.networks.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() =>
                    onChange({
                      ...value,
                      networks: toggle(value.networks, id),
                    })
                  }
                  className={cn(
                    "flex h-10 w-full items-center justify-between pl-3 pr-0 text-sm transition-colors hover:text-accent-text",
                    checked ? "font-bold text-accent-text" : "text-fg-muted",
                  )}
                >
                  <span>{NETWORK_LABEL[id]}</span>
                  {num(count(facets?.networks, id), false)}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}

export function Filters(props: FiltersProps) {
  if (props.variant === "figma") return <FigmaFilters {...props} />;
  const { value, facets, onChange, idPrefix = "f" } = props;
  const count = (
    list: { id: string; count: number }[] | undefined,
    id: string,
  ) => list?.find((f) => f.id === id)?.count;

  return (
    <div className="flex flex-col gap-10">
      <fieldset>
        <legend className="mb-3 text-lg font-bold">Coleções</legend>
        <ul className="flex flex-col">
          {COLLECTIONS.map((id) => {
            const checked = value.collections.includes(id);
            const n = count(facets?.collections, id);
            return (
              <li key={id}>
                <label className="flex min-h-10 cursor-pointer items-center gap-3 text-[15px]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      onChange({
                        ...value,
                        collections: toggle(value.collections, id),
                      })
                    }
                    aria-describedby={`${idPrefix}-c-${id}`}
                  />
                  <span className={checked ? "font-bold text-accent-text" : ""}>
                    {COLLECTION_LABEL[id]}
                  </span>
                  <span
                    id={`${idPrefix}-c-${id}`}
                    className="ml-auto text-sm text-fg-muted"
                  >
                    {n === undefined ? (
                      <Skeleton className="h-3.5 w-5" />
                    ) : (
                      <>
                        <span className="sr-only">resultados: </span>
                        {n}
                      </>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <PriceFilter {...props} idPrefix={idPrefix} />

      <fieldset>
        <legend className="mb-3 text-lg font-bold">Rede</legend>
        <ul className="flex flex-col">
          {NETWORKS.map((id) => {
            const checked = value.networks.includes(id);
            const n = count(facets?.networks, id);
            return (
              <li key={id}>
                <label className="flex min-h-10 cursor-pointer items-center gap-3 text-[15px]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      onChange({
                        ...value,
                        networks: toggle(value.networks, id),
                      })
                    }
                  />
                  <span className={checked ? "font-bold text-accent-text" : ""}>
                    {NETWORK_LABEL[id]}
                  </span>
                  <span className="ml-auto text-sm text-fg-muted">
                    {n === undefined ? (
                      <Skeleton className="h-3.5 w-5" />
                    ) : (
                      <>
                        <span className="sr-only">resultados: </span>
                        {n}
                      </>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
}
