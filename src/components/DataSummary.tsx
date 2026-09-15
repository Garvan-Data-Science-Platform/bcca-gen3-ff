import { useMemo } from 'react';
import { EmptyFilterSet, useGetCountsQuery } from '@gen3/core';

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

const MODALITY_FIELDS = [
  { field: 'wgs_count', label: 'WGS' },
  { field: 'wts_count', label: 'WTS' },
  { field: 'snp_count', label: 'SNP' },
  { field: 'chromium_count', label: 'Chromium' },
  { field: 'visium_count', label: 'Visium' },
  { field: 'xenium_count', label: 'Xenium' },
] as const;

// Stable filter objects (module-level) so RTK-Query doesn't refetch.
const gtZero = (field: string) =>
  ({
    mode: 'and',
    root: { [field]: { operator: '>', field, operand: 0 } },
  }) as any;
const F_WGS = gtZero('wgs_count');
const F_WTS = gtZero('wts_count');
const F_SNP = gtZero('snp_count');
const F_CHR = gtZero('chromium_count');
const F_VIS = gtZero('visium_count');
const F_XEN = gtZero('xenium_count');

interface ModalityStat {
  label: string;
  donorsWith: number;
}
interface CoverageData {
  totalDonors: number;
  modalities: ModalityStat[];
}

const useModalityCoverage = (): {
  data: CoverageData | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
} => {
  const total = useGetCountsQuery({ type: 'donor', filters: EmptyFilterSet });
  const c0 = useGetCountsQuery({ type: 'donor', filters: F_WGS });
  const c1 = useGetCountsQuery({ type: 'donor', filters: F_WTS });
  const c2 = useGetCountsQuery({ type: 'donor', filters: F_SNP });
  const c3 = useGetCountsQuery({ type: 'donor', filters: F_CHR });
  const c4 = useGetCountsQuery({ type: 'donor', filters: F_VIS });
  const c5 = useGetCountsQuery({ type: 'donor', filters: F_XEN });

  const donorCounts = [c0, c1, c2, c3, c4, c5];

  const isLoading =
    total.isLoading || donorCounts.some((q) => q.isLoading);
  const isError = total.isError || donorCounts.some((q) => q.isError);
  const firstError =
    (total.error as any) ?? donorCounts.find((q) => q.error)?.error;

  const coverage = useMemo<CoverageData | null>(() => {
    const totalDonors = Number(total.data ?? 0);
    if (!totalDonors) return null;

    const modalities: ModalityStat[] = MODALITY_FIELDS.map((m, i) => ({
      label: m.label,
      donorsWith: Number(donorCounts[i].data ?? 0),
    })).sort((a, b) => b.donorsWith - a.donorsWith);

    return { totalDonors, modalities };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    total.data,
    c0.data,
    c1.data,
    c2.data,
    c3.data,
    c4.data,
    c5.data,
  ]);

  const errorMessage = isError
    ? firstError?.data?.message ?? firstError?.message ?? 'Query failed'
    : null;

  return { data: coverage, isLoading, isError, errorMessage };
};

const PRIMARY = '#99286B';
const TRACK = '#F3F0F2';

const WAFFLE_COLS = 10;
const WAFFLE_ROWS = 10;
const WAFFLE_CELL = 8;
const WAFFLE_GAP = 2;
const WAFFLE_UNITS =
  WAFFLE_COLS * (WAFFLE_CELL + WAFFLE_GAP) - WAFFLE_GAP;

const WaffleChart = ({ data }: { data: CoverageData }) => {
  const total = WAFFLE_COLS * WAFFLE_ROWS;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
    >
      {data.modalities.map((m) => {
        const pct = (m.donorsWith / data.totalDonors) * 100;
        const filled = Math.round((m.donorsWith / data.totalDonors) * total);
        return (
          <div
            key={m.label}
            className="min-w-0 rounded border border-base-lighter p-4 flex items-center gap-4"
          >
            <div
              className="shrink-0 aspect-square w-[38%] max-w-[120px] min-w-[64px]"
              role="img"
              aria-label={`${m.label}: ${m.donorsWith} of ${data.totalDonors} participants (${pct.toFixed(0)}%)`}
            >
              <svg
                viewBox={`0 0 ${WAFFLE_UNITS} ${WAFFLE_UNITS}`}
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
              >
                {Array.from({ length: total }).map((_, i) => {
                  const col = i % WAFFLE_COLS;
                  const rowFromBottom = Math.floor(i / WAFFLE_COLS);
                  const row = WAFFLE_ROWS - 1 - rowFromBottom;
                  const x = col * (WAFFLE_CELL + WAFFLE_GAP);
                  const y = row * (WAFFLE_CELL + WAFFLE_GAP);
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={y}
                      width={WAFFLE_CELL}
                      height={WAFFLE_CELL}
                      rx={1}
                      fill={i < filled ? PRIMARY : TRACK}
                    />
                  );
                })}
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-base-darkest truncate">
                {m.label}
              </div>
              <div className="text-3xl font-bold text-primary tabular-nums leading-none mt-1">
                {pct.toFixed(0)}%
              </div>
              <div className="text-xs text-base-dark tabular-nums mt-1 truncate">
                {formatNumber(m.donorsWith)} / {formatNumber(data.totalDonors)}{' '}
                participants
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ModalityCoverageSection = () => {
  const { data, isLoading, isError, errorMessage } = useModalityCoverage();

  if (isLoading) {
    return (
      <div className="text-sm text-base-dark py-6 text-center">
        Loading modality coverage…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="text-sm text-base-dark py-6 text-center">
        Could not load modality coverage
        {errorMessage ? ` — ${errorMessage}` : '.'}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="text-sm text-base-dark py-6 text-center">
        No modality coverage available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-base-lighter bg-base-max px-4 py-4">
      <div className="mb-3">
        <p className="text-xs text-base-dark">
          Share of {formatNumber(data.totalDonors)} participants with ≥1 assay
          of each modality.
        </p>
      </div>
      <WaffleChart data={data} />
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
      className="w-full max-w-6xl mx-auto px-6 pt-4 pb-6"
    >
      <h2
        id="data-summary-heading"
        className="text-xl font-semibold text-primary mb-3"
      >
        Current data holdings
      </h2>
      <div className="flex flex-wrap gap-3">
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

      <div className="mt-5">
        <h2 className="text-xl font-semibold text-primary mb-3">
          Assay modality coverage
        </h2>
        <ModalityCoverageSection />
      </div>
    </section>
  );
};

export default DataSummary;
