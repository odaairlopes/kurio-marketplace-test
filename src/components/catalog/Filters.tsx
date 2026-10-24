import { useEffect, useState } from "react";
import type { CatalogResponse, CollectionId, Network } from "@/api/contracts";
import { COLLECTIONS, NETWORKS } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox, Slider } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { cmp, parseDecimalInput } from "@/lib/money";
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

export function Filters(props: FiltersProps) {
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
