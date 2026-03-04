"use client";

import { useEffect, useRef } from 'react';
import { useTranslation } from './_components/LanguageProvider';
import './manager.css';

export default function Page() {
  const apiRef = useRef(null);
  const { t, isReady } = useTranslation();

  useEffect(() => {
    let active = true;
    import('@/lib/manager-ui').then((mod) => {
      if (!active) return;
      apiRef.current = mod;
      if (mod.initManager) {
        mod.initManager();
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const callApi = (method, ...args) => {
    const api = apiRef.current;
    if (!api || typeof api[method] !== 'function') {
      return;
    }
    api[method](...args);
  };

  if (!isReady) {
    return <div className="page"><div style={{ padding: '20px', color: '#aaa' }}>Loading...</div></div>;
  }

  return (
    <>
      <div className="page">
        <header className="top-bar">
          <div className="title-wrap">
            <div className="title">
              <span>FiftyOne</span> Manager
            </div>
            <div className="subtitle">{t('manager.subtitle')}</div>
          </div>
          <div className="top-actions" data-tour="bulk-actions">
            <button
              id="removeSelectedBtn"
              className="btn danger"
              onClick={() => callApi('removeSelectedInstances')}
              disabled
            >
              {t('manager.removeSelected')}
            </button>
            <button
              className="btn ghost"
              data-tour="add-instance"
              onClick={() => callApi('showAddModal')}
            >
              {t('manager.addInstance')}
            </button>
          </div>
        </header>

        <section className="section">
          <div className="section-title" data-tour="select-all">
            <input
              type="checkbox"
              id="selectAllCheckbox"
              className="instance-select-checkbox"
              onChange={() => callApi('toggleSelectAll')}
              style={{ marginRight: '8px' }}
            />
            {t('manager.instances')}
            <small>
              {t('manager.basePath')}: <span id="basePath">-</span>
            </small>
          </div>
          <div id="instancesContainer" className="instances" data-tour="instances-list">
            <div className="empty-state">
              <h2>{t('manager.noInstances')}</h2>
              <p>{t('manager.noInstancesHint')}</p>
            </div>
          </div>
        </section>
      </div>

      <div id="instanceModal" className="modal" data-tour="instance-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2 id="modalTitle">{t('manager.modal.addTitle')}</h2>
            <button className="close-btn" onClick={() => callApi('closeModal')} type="button">
              &times;
            </button>
          </div>
          <div id="modalError" className="error-message" style={{ display: 'none' }} />
          <form id="instanceForm" onSubmit={(event) => callApi('saveInstance', event)}>
            <div className="form-group" data-tour="form-name">
              <label htmlFor="instanceName">{t('manager.modal.instanceName')} *</label>
              <input type="text" id="instanceName" required />
              <small>{t('manager.modal.instanceNameHint')}</small>
              <div
                id="instanceNameError"
                className="error-message"
                style={{ display: 'none', marginTop: '8px' }}
              >
                {t('manager.modal.instanceNameExists')}
              </div>
            </div>
            <div className="form-group" data-tour="form-dataset">
              <label htmlFor="datasetPath">{t('manager.modal.datasetPath')} *</label>
              <div className="dataset-browser">
                <div className="breadcrumb" id="breadcrumb" />
                <div className="folder-search">
                  <input type="text" id="folderSearch" placeholder={t('manager.folder.searchPlaceholder')} onInput={() => callApi('filterFolderList')} />
                  <button type="button" className="folder-search-clear" id="folderSearchClear" onClick={() => callApi('clearFolderSearch')}>✕</button>
                </div>
                <div className="folder-list" id="folderList">
                  <div className="folder-item">{t('common.loading')}</div>
                </div>
              </div>
              <input type="text" id="datasetPath" required placeholder={t('manager.modal.datasetPathHint')} />
              <small>{t('manager.modal.datasetPathHint')}</small>
            </div>
            <div className="form-group" data-tour="form-classfile">
              <label htmlFor="classFile">{t('manager.modal.classFile')}</label>
              <div className="dataset-browser">
                <div className="breadcrumb" id="classBreadcrumb" />
                <div className="folder-search">
                  <input type="text" id="classFolderSearch" placeholder={t('manager.folder.searchPlaceholder')} onInput={() => callApi('filterClassFolderList')} />
                  <button type="button" className="folder-search-clear" id="classFolderSearchClear" onClick={() => callApi('clearClassFolderSearch')}>✕</button>
                </div>
                <div className="folder-list" id="classFolderList">
                  <div className="folder-item">{t('common.loading')}</div>
                </div>
              </div>
              <input type="text" id="classFile" placeholder={t('manager.modal.datasetPathHint')} />
              <small>{t('manager.modal.classFileHint')}</small>
              <div id="classPreview" className="class-preview">
                <div className="class-preview-header">
                  <span>{t('manager.modal.preview')}</span>
                  <span id="classPreviewMeta" className="class-preview-badge">
                    0 {t('manager.modal.lines')}
                  </span>
                </div>
                <div id="classPreviewBody" className="class-preview-body">
                  {t('manager.modal.selectClassFile')}
                </div>
                <div id="classPreviewNote" className="class-preview-note" style={{ display: 'none' }} />
                <div id="classPreviewError" className="class-preview-error" style={{ display: 'none' }} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="duplicateMode">{t('manager.modal.duplicateModeLabel')}</label>
              <select id="duplicateMode" onChange={() => callApi('updateDuplicateModeDisplay')}>
                <option value="none">{t('manager.modal.duplicateModeNone')}</option>
                <option value="move">{t('manager.modal.duplicateModeMove')}</option>
                <option value="delete">{t('manager.modal.duplicateModeDelete')}</option>
              </select>
              <small>{t('manager.modal.duplicateModeHint')}</small>
              <div id="duplicateModeEnvInfo" className="duplicate-mode-info" style={{ display: 'none' }}>
                <span className="duplicate-mode-label">{t('manager.modal.duplicateMode')}:</span>
                <span id="duplicateModeAction" className="duplicate-mode-action"></span>
                <span id="duplicateModeLabels" className="duplicate-mode-labels"></span>
                <span id="duplicateModePattern" className="duplicate-mode-pattern"></span>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="threshold">{t('manager.modal.duplicateThreshold')}</label>
              <input type="number" id="threshold" step="0.01" min="0" max="1" />
              <small>{t('manager.modal.duplicateThresholdHint')}</small>
            </div>
            <div className="form-group">
              <div className="checkbox-group">
                <input type="checkbox" id="pentagonFormat" />
                <label htmlFor="pentagonFormat">{t('manager.modal.obbFormat')}</label>
              </div>
              <small>{t('manager.modal.obbFormatHint')}</small>
            </div>
            <div className="form-group" id="obbModeGroup" style={{ display: 'none' }}>
              <label htmlFor="obbMode">{t('manager.modal.obbCreationMode')}</label>
              <select id="obbMode">
                <option value="rectangle">{t('manager.modal.obbModeRectangle')}</option>
                <option value="4point">{t('manager.modal.obbMode4Point')}</option>
              </select>
              <small>{t('manager.modal.obbModeHint')}</small>
            </div>
            <div className="form-group" data-tour="form-save">
              <button type="submit" id="saveInstanceBtn" className="btn success" style={{ width: '100%' }}>
                {t('manager.modal.saveInstance')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div id="processingOverlay" className="processing-overlay" role="alert" aria-live="assertive">
        <div className="processing-card">
          <div className="spinner" aria-hidden="true" />
          <div id="processingText" className="processing-text">
            {t('common.processing')}
          </div>
        </div>
      </div>
    </>
  );
}
