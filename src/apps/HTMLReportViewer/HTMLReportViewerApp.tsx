import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';

export interface AssayConfig {
  id: string;
  label: string;
  indexCsv: string;
  landingPage: string | null;
  sampleReportDir: string;
  sampleIdColumn: string;
  reportPathColumn: string | null;
}

export interface HTMLReportViewerConfig {
  reportsBaseUrl: string;
  assays: AssayConfig[];
}

interface SampleRow {
  sampleId: string;
  reportPath: string | null;
  extras: Record<string, string>;
}

interface IndexState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  rows: SampleRow[];
  error?: string;
  extraColumns: string[];
}

const IFRAME_SANDBOX = 'allow-same-origin allow-scripts allow-popups';

const EXTRA_SEARCHABLE_HINTS = ['donor_id', 'tissue_id', 'gussid'];

const joinUrl = (base: string, ...parts: string[]): string => {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedParts = parts
    .filter((p) => p != null && p !== '')
    .map((p) => p.replace(/^\/+|\/+$/g, ''));
  return [trimmedBase, ...trimmedParts].join('/');
};

// Minimal RFC-4180-ish CSV parser: header row + quoted values with escaped quotes.
const parseCsv = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n' || ch === '\r') {
      pushField();
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  const nonEmpty = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const dataRows = nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (r[idx] ?? '').trim();
    });
    return record;
  });
  return { headers, rows: dataRows };
};

const deriveSampleFilename = (sampleId: string): string =>
  sampleId.endsWith('.html') ? sampleId : `${sampleId}.html`;

const buildReportUrl = (
  base: string,
  assay: AssayConfig,
  row: SampleRow,
): string => {
  if (row.reportPath) {
    return joinUrl(base, row.reportPath);
  }
  return joinUrl(base, assay.sampleReportDir, deriveSampleFilename(row.sampleId));
};

const buildLandingUrl = (base: string, assay: AssayConfig): string | null =>
  assay.landingPage ? joinUrl(base, assay.landingPage) : null;

type Props = Partial<HTMLReportViewerConfig>;

const HTMLReportViewerApp: React.FC<Props> = (props) => {
  const assays = props.assays ?? [];
  const reportsBaseUrl = props.reportsBaseUrl ?? '';
  const hasConfig = props.assays !== undefined || props.reportsBaseUrl !== undefined;

  const [selectedAssayId, setSelectedAssayId] = useState<string | null>(
    assays[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState<IndexState>({
    status: 'idle',
    rows: [],
    extraColumns: [],
  });
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [viewingLanding, setViewingLanding] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);

  const selectedAssay = useMemo(
    () => assays.find((a) => a.id === selectedAssayId) ?? null,
    [assays, selectedAssayId],
  );

  useEffect(() => {
    if (!selectedAssay || !reportsBaseUrl) return;
    let cancelled = false;
    setIndex({ status: 'loading', rows: [], extraColumns: [] });
    setSelectedSampleId(null);
    setViewingLanding(false);
    setIframeError(null);

    const url = joinUrl(reportsBaseUrl, selectedAssay.indexCsv);
    fetch(url, { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load index (${res.status} ${res.statusText})`);
        }
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const { headers, rows } = parseCsv(text);
        const sampleCol = selectedAssay.sampleIdColumn;
        const pathCol = selectedAssay.reportPathColumn;
        if (!headers.includes(sampleCol)) {
          throw new Error(
            `CSV missing expected sample column "${sampleCol}". Found: ${headers.join(', ') || '(no headers)'}`,
          );
        }
        const extraColumns = headers.filter(
          (h) => h !== sampleCol && h !== pathCol,
        );
        const parsedRows: SampleRow[] = rows
          .map((r) => ({
            sampleId: r[sampleCol],
            reportPath: pathCol ? r[pathCol] || null : null,
            extras: extraColumns.reduce<Record<string, string>>((acc, col) => {
              acc[col] = r[col] ?? '';
              return acc;
            }, {}),
          }))
          .filter((r) => r.sampleId);
        setIndex({ status: 'ready', rows: parsedRows, extraColumns });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setIndex({
          status: 'error',
          rows: [],
          extraColumns: [],
          error: message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAssay, reportsBaseUrl]);

  const searchableExtras = useMemo(
    () =>
      index.extraColumns.filter((col) =>
        EXTRA_SEARCHABLE_HINTS.includes(col.toLowerCase()),
      ),
    [index.extraColumns],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return index.rows;
    return index.rows.filter((r) => {
      if (r.sampleId.toLowerCase().includes(q)) return true;
      return searchableExtras.some((col) =>
        (r.extras[col] ?? '').toLowerCase().includes(q),
      );
    });
  }, [index.rows, search, searchableExtras]);

  const selectedRow = useMemo(
    () => index.rows.find((r) => r.sampleId === selectedSampleId) ?? null,
    [index.rows, selectedSampleId],
  );

  const landingUrl = selectedAssay ? buildLandingUrl(reportsBaseUrl, selectedAssay) : null;

  const iframeUrl = useMemo(() => {
    if (!selectedAssay) return null;
    if (viewingLanding) return landingUrl;
    if (selectedRow) return buildReportUrl(reportsBaseUrl, selectedAssay, selectedRow);
    return null;
  }, [reportsBaseUrl, selectedAssay, selectedRow, viewingLanding, landingUrl]);

  useEffect(() => {
    setIframeError(null);
  }, [iframeUrl]);

  if (!hasConfig) {
    return (
      <Box p="lg">
        <Alert color="red" title="Missing configuration">
          No configuration was loaded for the HTML Report Viewer. Ensure
          <code> config/gen3/apps/HTMLReportViewer.json</code> is present.
        </Alert>
      </Box>
    );
  }

  if (assays.length === 0) {
    return (
      <Box p="lg">
        <Alert color="yellow" title="No assays configured">
          The <code>assays</code> list in <code>HTMLReportViewer.json</code> is empty.
        </Alert>
      </Box>
    );
  }

  return (
    <Stack
      p="md"
      gap="md"
      style={{
        flex: 1,
        alignSelf: 'stretch',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
      }}
    >
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Title order={3}>HTML Report Viewer</Title>
          <Text size="sm" c="dimmed">
            Browse per-sample HTML reports generated from genomic workflows.
          </Text>
        </Stack>
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select
            label="Assay / workflow"
            data={assays.map((a) => ({ value: a.id, label: a.label }))}
            value={selectedAssayId}
            onChange={(value) => {
              setSelectedAssayId(value);
              setSearch('');
            }}
            allowDeselect={false}
            w={260}
          />
          <TextInput
            label="Search samples"
            placeholder={
              searchableExtras.length > 0
                ? `sample_id or ${searchableExtras.join(', ')}`
                : 'sample_id'
            }
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={320}
          />
          {landingUrl && (
            <Button
              variant={viewingLanding ? 'filled' : 'light'}
              onClick={() => {
                setViewingLanding(true);
                setSelectedSampleId(null);
              }}
            >
              View all {selectedAssay?.label ?? ''} reports
            </Button>
          )}
        </Group>
      </Group>

      <Group align="stretch" gap="md" style={{ flex: 1, minHeight: 0 }}>
        <Box
          style={{
            width: 320,
            borderRight: '1px solid var(--mantine-color-gray-3)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Text fw={600} mb="xs">
            Samples
            {index.status === 'ready' && (
              <Text component="span" c="dimmed" fw={400} size="sm">
                {' '}({filteredRows.length}/{index.rows.length})
              </Text>
            )}
          </Text>

          {index.status === 'loading' && (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="sm">Loading sample index…</Text>
            </Group>
          )}

          {index.status === 'error' && (
            <Alert color="red" title="Could not load sample index">
              <Text size="sm">{index.error}</Text>
              <Text size="xs" c="dimmed" mt="xs">
                If this is a CORS error, verify the bucket CORS policy allows
                requests from this origin.
              </Text>
            </Alert>
          )}

          {index.status === 'ready' && filteredRows.length === 0 && (
            <Text size="sm" c="dimmed">
              No samples match the current search.
            </Text>
          )}

          {index.status === 'ready' && filteredRows.length > 0 && (
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap={2}>
                {filteredRows.map((row) => {
                  const isActive =
                    !viewingLanding && row.sampleId === selectedSampleId;
                  return (
                    <UnstyledButton
                      key={row.sampleId}
                      onClick={() => {
                        setSelectedSampleId(row.sampleId);
                        setViewingLanding(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 4,
                        backgroundColor: isActive
                          ? 'var(--mantine-color-blue-1)'
                          : 'transparent',
                      }}
                    >
                      <Text size="sm" fw={isActive ? 600 : 400}>
                        {row.sampleId}
                      </Text>
                      {searchableExtras.length > 0 && (
                        <Text size="xs" c="dimmed">
                          {searchableExtras
                            .map((col) => row.extras[col])
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
          )}
        </Box>

        <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {!iframeUrl && (
            <Box
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--mantine-color-gray-3)',
                borderRadius: 4,
              }}
            >
              <Text c="dimmed">
                Select a sample from the list to view its report.
              </Text>
            </Box>
          )}

          {iframeUrl && iframeError && (
            <Alert color="red" title="Could not load report" mb="xs">
              <Text size="sm">{iframeError}</Text>
              <Text size="xs" mt="xs">
                URL: <code>{iframeUrl}</code>
              </Text>
            </Alert>
          )}

          {iframeUrl && (
            <>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" truncate>
                  {iframeUrl}
                </Text>
                <Button
                  variant="subtle"
                  size="xs"
                  component="a"
                  href={iframeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in new tab
                </Button>
              </Group>
              <iframe
                key={iframeUrl}
                src={iframeUrl}
                title="HTML report"
                sandbox={IFRAME_SANDBOX}
                onError={() =>
                  setIframeError('The report failed to load in the viewer.')
                }
                style={{
                  flex: 1,
                  width: '100%',
                  border: '1px solid var(--mantine-color-gray-3)',
                  borderRadius: 4,
                  backgroundColor: 'white',
                }}
              />
            </>
          )}
        </Box>
      </Group>
    </Stack>
  );
};

export default HTMLReportViewerApp;
