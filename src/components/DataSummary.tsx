import React from 'react';
import { EmptyFilterSet, useGetCountsQuery, useGetAggsQuery } from '@gen3/core';

const formatNumber = (n: number | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US').format(n);

interface StatTileProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  isError: boolean;
}

const StatTile = ({ label, value, isLoading, isError }: StatTileProps) => (
  <div className="flex-1 min-w-[180px] rounded-lg border border-base-lighter bg-base-max px-6 py-5">
    <div className="text-xs font-semibold uppercase tracking-wide text-base-dark">
      {label}
    </div>
    <div
      className="mt-2 text-4xl font-bold text-primary tabular-nums"
      aria-live="polite"
    >
      {isError ? '—' : isLoading ? '…' : formatNumber(value)}
    </div>
  </div>
);

interface AggBucket {
  key: string;
  count: number;
}

const useModalityBuckets = (): {
  buckets: AggBucket[];
  isLoading: boolean;
  isError: boolean;
} => {
  const { data, isLoading, isError } = useGetAggsQuery({
    type: 'assay',
    fields: ['modality'],
    filters: EmptyFilterSet,
  });

  const raw = ((data as any)?.modality ?? []) as Array<{
    key: unknown;
    count: unknown;
  }>;

  const buckets: AggBucket[] = raw
    .map((b) => ({
      key: b.key == null ? 'Unknown' : String(b.key),
      count: Number(b.count ?? 0),
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

  return { buckets, isLoading, isError };
};

const ModalityBarChart = () => {
  const { buckets, isLoading, isError } = useModalityBuckets();

  if (isLoading) {
    return (
      <div className="text-sm text-base-dark py-6 text-center">
        Loading assay breakdown…
      </div>
    );
  }
  if (isError || buckets.length === 0) {
    return (
      <div className="text-sm text-base-dark py-6 text-center">
        No assay breakdown available.
      </div>
    );
  }

  const max = Math.max(...buckets.map((b) => b.count));

  return (
    <div
      className="grid items-center gap-x-4 gap-y-2 text-sm"
      style={{ gridTemplateColumns: 'minmax(120px, max-content) 1fr auto' }}
      role="list"
      aria-label="Assays grouped by modality"
    >
      {buckets.map((b) => {
        const pct = Math.max(2, (b.count / max) * 100);
        return (
          <React.Fragment key={b.key}>
            <div
              className="truncate text-base-darkest font-medium"
              title={b.key}
              role="listitem"
            >
              {b.key}
            </div>
            <div
              className="relative h-6 rounded bg-base-lightest overflow-hidden"
              aria-hidden="true"
            >
              <div
                className="absolute inset-y-0 left-0 rounded bg-primary transition-[width] duration-500"
                style={{ width: `${pct}%` }}
                title={`${b.key}: ${formatNumber(b.count)}`}
              />
            </div>
            <div className="tabular-nums text-base-darkest text-right min-w-[64px]">
              {formatNumber(b.count)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const DataSummary = () => {
  const donors = useGetCountsQuery({ type: 'donor', filters: EmptyFilterSet });
  const tissues = useGetCountsQuery({ type: 'tissue', filters: EmptyFilterSet });
  const assays = useGetCountsQuery({ type: 'assay', filters: EmptyFilterSet });

  return (
    <section
      aria-labelledby="data-summary-heading"
      className="w-full max-w-6xl mx-auto px-6 py-10"
    >
      <h2
        id="data-summary-heading"
        className="text-xl font-semibold text-primary mb-4"
      >
        Current data holdings
      </h2>
      <div className="flex flex-wrap gap-4">
        <StatTile
          label="Donors"
          value={donors.data as number | undefined}
          isLoading={donors.isLoading}
          isError={donors.isError}
        />
        <StatTile
          label="Tissues"
          value={tissues.data as number | undefined}
          isLoading={tissues.isLoading}
          isError={tissues.isError}
        />
        <StatTile
          label="Assays"
          value={assays.data as number | undefined}
          isLoading={assays.isLoading}
          isError={assays.isError}
        />
      </div>

      <div className="mt-8 rounded-lg border border-base-lighter bg-base-max px-6 py-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-base-dark mb-4">
          Assays by modality
        </h3>
        <ModalityBarChart />
      </div>
    </section>
  );
};

export default DataSummary;
