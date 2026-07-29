import { createGen3App } from '@gen3/core';
import HTMLReportViewerApp from './HTMLReportViewerApp';

const _APP_NAME = 'HTMLReportViewer';
const _APP_VERSION = '1.0.0';

export const registerApp = () =>
  createGen3App({
    App: HTMLReportViewerApp,
    name: _APP_NAME,
    version: _APP_VERSION,
    requiredEntityTypes: [],
  });

export const HTMLReportViewerAppName = _APP_NAME;
